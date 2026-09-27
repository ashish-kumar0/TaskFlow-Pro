from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from datetime import timedelta

from .database import engine, Base, get_db
from .models import Task, TaskDependency, TaskStatus, DependencyState
from .schemas import (
    TaskCreate, TaskUpdate, TaskOut,
    DependencyCreate, DependencyOut,
    AISuggestionResponse, DependencyProposal
)
from .engine import (
    check_cycle_addition,
    recalculate_schedule_and_statuses,
    DAGCycleException
)
from .ai_service import generate_dependency_suggestions

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TaskFlow Pro API",
    description="Intelligent DAG-backed Project Management Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def format_task_response(task: Task) -> TaskOut:
    prereqs = [d.prerequisite_id for d in task.prerequisites]
    deps = [d.dependent_id for d in task.dependents]
    return TaskOut(
        id=task.id,
        title=task.title,
        description=task.description,
        duration_days=task.duration_days,
        start_date=task.start_date,
        end_date=task.end_date,
        status=task.status,
        dependency_state=task.dependency_state,
        position=task.position,
        prerequisite_ids=prereqs,
        dependent_ids=deps
    )

@app.get("/api/tasks", response_model=List[TaskOut])
def list_tasks(db: Session = Depends(get_db)):
    tasks = db.query(Task).order_by(Task.id.asc()).all()
    return [format_task_response(t) for t in tasks]

@app.post("/api/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db)):
    end_date = task_in.start_date + timedelta(days=task_in.duration_days)
    new_task = Task(
        title=task_in.title,
        description=task_in.description,
        duration_days=task_in.duration_days,
        start_date=task_in.start_date,
        end_date=end_date,
        status=task_in.status.value,
        dependency_state=DependencyState.READY.value
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    
    recalculate_schedule_and_statuses(db)
    db.refresh(new_task)
    return format_task_response(new_task)

@app.put("/api/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: int, updates: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    new_status = updates.status.value if updates.status else None

    # Forward movement restriction: agar task Blocked hai aur Backlog se aage move karne ki koshish karein
    if new_status and new_status != TaskStatus.BACKLOG.value and new_status != task.status:
        if task.dependency_state == DependencyState.BLOCKED.value:
            raise HTTPException(
                status_code=400,
                detail=f"Task #{task_id} is BLOCKED. All upstream prerequisites must be 'Done' first!"
            )

    if updates.title is not None:
        task.title = updates.title
    if updates.description is not None:
        task.description = updates.description
    if updates.duration_days is not None:
        task.duration_days = updates.duration_days
        task.end_date = task.start_date + timedelta(days=task.duration_days)
    if updates.start_date is not None:
        task.start_date = updates.start_date
        task.end_date = task.start_date + timedelta(days=task.duration_days)
    if new_status is not None:
        task.status = new_status
    if updates.position is not None:
        task.position = updates.position

    db.commit()
    # Status recalculate karein taaki cascade rollback ya unblock trigger ho
    recalculate_schedule_and_statuses(db)
    db.refresh(task)
    return format_task_response(task)

@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    recalculate_schedule_and_statuses(db)
    return None

@app.get("/api/dependencies", response_model=List[DependencyOut])
def list_dependencies(db: Session = Depends(get_db)):
    return db.query(TaskDependency).all()

@app.post("/api/dependencies", response_model=DependencyOut, status_code=status.HTTP_201_CREATED)
def create_dependency(edge_in: DependencyCreate, db: Session = Depends(get_db)):
    p = db.query(Task).filter(Task.id == edge_in.prerequisite_id).first()
    d = db.query(Task).filter(Task.id == edge_in.dependent_id).first()
    if not p or not d:
        raise HTTPException(status_code=404, detail="One or both tasks do not exist.")

    existing = db.query(TaskDependency).filter(
        TaskDependency.prerequisite_id == edge_in.prerequisite_id,
        TaskDependency.dependent_id == edge_in.dependent_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Dependency link already exists.")

    try:
        check_cycle_addition(db, edge_in.prerequisite_id, edge_in.dependent_id)
    except DAGCycleException as e:
        raise HTTPException(status_code=400, detail=str(e))

    new_edge = TaskDependency(
        prerequisite_id=edge_in.prerequisite_id,
        dependent_id=edge_in.dependent_id
    )
    db.add(new_edge)
    db.commit()
    db.refresh(new_edge)

    recalculate_schedule_and_statuses(db)
    return new_edge

@app.delete("/api/dependencies/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dependency(edge_id: int, db: Session = Depends(get_db)):
    edge = db.query(TaskDependency).filter(TaskDependency.id == edge_id).first()
    if not edge:
        raise HTTPException(status_code=404, detail="Dependency link not found.")
    
    db.delete(edge)
    db.commit()
    recalculate_schedule_and_statuses(db)
    return None

@app.post("/api/ai/suggest-dependencies", response_model=AISuggestionResponse)
def suggest_dependencies(db: Session = Depends(get_db)):
    tasks = db.query(Task).all()
    existing_deps = db.query(TaskDependency).all()
    existing_pairs = {(e.prerequisite_id, e.dependent_id) for e in existing_deps}
    
    raw_proposals = generate_dependency_suggestions(tasks, existing_deps)
    valid_proposals = []
    
    for prop in raw_proposals:
        p_id = prop.get("prerequisite_id")
        d_id = prop.get("dependent_id")
        if (p_id, d_id) in existing_pairs:
            continue
        try:
            check_cycle_addition(db, p_id, d_id)
            valid_proposals.append(DependencyProposal(**prop))
        except DAGCycleException:
            continue

    return AISuggestionResponse(proposals=valid_proposals)

@app.get("/api/critical-path")
def get_critical_path(db: Session = Depends(get_db)):
    from .engine import compute_critical_path
    return compute_critical_path(db)
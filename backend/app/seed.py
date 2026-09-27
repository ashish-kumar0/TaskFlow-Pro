from datetime import date, timedelta
from .database import SessionLocal, engine, Base
from .models import Task, TaskDependency, TaskStatus, DependencyState
from .engine import recalculate_schedule_and_statuses

def seed_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    today = date.today()

    sample_tasks = [
        (1, "Database Schema Design", "Design relational tables, ER diagram, and initial indexing strategy.", 2, 0, TaskStatus.DONE),
        (2, "Auth & Session Service", "Implement JWT authentication, refresh tokens, and password hashing.", 3, 2, TaskStatus.DONE),
        (3, "Core API Endpoints", "Build CRUD routes for tasks and dependencies with validation.", 4, 5, TaskStatus.IN_PROGRESS),
        (4, "DAG Engine & Topological Sorter", "Implement cycle detection, propagation, and status calculation.", 3, 5, TaskStatus.IN_PROGRESS),
        (5, "AI Suggestion Pipeline", "Prompt engineering, structured output schema, and LLM integration.", 2, 8, TaskStatus.BACKLOG),
        (6, "Frontend Kanban Board", "Build 4-column drag-and-drop board using dnd-kit and Tailwind.", 4, 9, TaskStatus.BACKLOG),
        (7, "DAG Graph Visualization", "Render nodes, edges, and critical path highlights with React Flow.", 3, 9, TaskStatus.BACKLOG),
        (8, "Integration Test Suite", "End-to-end testing for multi-path converging delay propagation.", 2, 13, TaskStatus.BACKLOG),
        (9, "Production Deployment", "Set up Docker, database migrations, and deploy to cloud host.", 2, 15, TaskStatus.BACKLOG),
        (10, "Documentation & Readme", "Document architectural assumptions, limitations, and AI declaration.", 1, 16, TaskStatus.BACKLOG),
    ]

    for task_id, title, desc, duration, offset, status in sample_tasks:
        s_date = today + timedelta(days=offset)
        e_date = s_date + timedelta(days=duration)
        task = Task(
            id=task_id,
            title=title,
            description=desc,
            duration_days=duration,
            start_date=s_date,
            end_date=e_date,
            status=status.value,
            dependency_state=DependencyState.READY.value,
            position=task_id
        )
        db.add(task)
    
    db.commit()

    edges = [
        (1, 2),
        (1, 3),
        (3, 4),
        (3, 5),
        (4, 6),
        (4, 7),
        (6, 8),
        (7, 8),
        (8, 9),
        (9, 10),
    ]

    for prereq_id, dep_id in edges:
        dep = TaskDependency(prerequisite_id=prereq_id, dependent_id=dep_id)
        db.add(dep)
    
    db.commit()

    # Recalculate topological dates and Ready/Blocked states
    recalculate_schedule_and_statuses(db)

    print("Database seeded and DAG schedule recalculated successfully.")
    db.close()

if __name__ == "__main__":
    seed_database()

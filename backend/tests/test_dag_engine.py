import pytest
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Task, TaskDependency, TaskStatus, DependencyState
from app.engine import check_cycle_addition, recalculate_schedule_and_statuses, DAGCycleException

TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture
def db():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_cycle_detection_blocks_circular_edge(db):
    """Verifies that adding a reverse edge creating A -> B -> A is rejected."""
    t1 = Task(id=1, title="Task 1", duration_days=2, start_date=date(2026, 1, 1), end_date=date(2026, 1, 3))
    t2 = Task(id=2, title="Task 2", duration_days=2, start_date=date(2026, 1, 3), end_date=date(2026, 1, 5))
    db.add_all([t1, t2])
    db.commit()

    db.add(TaskDependency(prerequisite_id=1, dependent_id=2))
    db.commit()

    with pytest.raises(DAGCycleException):
        check_cycle_addition(db, prereq_id=2, dep_id=1)

def test_diamond_dependency_no_compounding(db):
    """
    Diamond Graph:
          A (2 days, Jan 1 - Jan 3)
         / \
    B (3d)  C (5d)
         \ /
          D (2 days)
    D must start on max(B.end, C.end) without duplicate delay compounding.
    """
    start = date(2026, 1, 1)
    tA = Task(id=1, title="A", duration_days=2, start_date=start, end_date=start + timedelta(days=2))
    tB = Task(id=2, title="B", duration_days=3, start_date=start, end_date=start + timedelta(days=3))
    tC = Task(id=3, title="C", duration_days=5, start_date=start, end_date=start + timedelta(days=5))
    tD = Task(id=4, title="D", duration_days=2, start_date=start, end_date=start + timedelta(days=2))
    db.add_all([tA, tB, tC, tD])
    db.commit()

    db.add_all([
        TaskDependency(prerequisite_id=1, dependent_id=2),
        TaskDependency(prerequisite_id=1, dependent_id=3),
        TaskDependency(prerequisite_id=2, dependent_id=4),
        TaskDependency(prerequisite_id=3, dependent_id=4),
    ])
    db.commit()

    recalculate_schedule_and_statuses(db)

    task_map = {t.id: t for t in db.query(Task).all()}
    
    assert task_map[1].end_date == date(2026, 1, 3)
    assert task_map[2].start_date == date(2026, 1, 3)
    assert task_map[2].end_date == date(2026, 1, 6)
    assert task_map[3].start_date == date(2026, 1, 3)
    assert task_map[3].end_date == date(2026, 1, 8)
    assert task_map[4].start_date == date(2026, 1, 8)
    assert task_map[4].end_date == date(2026, 1, 10)

def test_rollback_cascade_blocks_downstream(db):
    """
    Verifies that moving an upstream task from Done back to In Progress
    switches dependent task from READY back to BLOCKED.
    """
    t1 = Task(id=1, title="A", duration_days=2, start_date=date(2026, 1, 1), end_date=date(2026, 1, 3), status=TaskStatus.DONE.value)
    t2 = Task(id=2, title="B", duration_days=2, start_date=date(2026, 1, 3), end_date=date(2026, 1, 5), status=TaskStatus.BACKLOG.value)
    db.add_all([t1, t2])
    db.commit()

    db.add(TaskDependency(prerequisite_id=1, dependent_id=2))
    db.commit()

    recalculate_schedule_and_statuses(db)
    t2_refreshed = db.query(Task).filter(Task.id == 2).first()
    assert t2_refreshed.dependency_state == DependencyState.READY.value

    t1.status = TaskStatus.IN_PROGRESS.value
    db.commit()

    recalculate_schedule_and_statuses(db)
    db.refresh(t2_refreshed)
    assert t2_refreshed.dependency_state == DependencyState.BLOCKED.value

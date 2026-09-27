from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
import enum
from .database import Base

class TaskStatus(str, enum.Enum):
    BACKLOG = "Backlog"
    IN_PROGRESS = "In Progress"
    REVIEW = "Review"
    DONE = "Done"

class DependencyState(str, enum.Enum):
    READY = "Ready"
    BLOCKED = "Blocked"

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default=TaskStatus.BACKLOG.value, nullable=False)
    dependency_state = Column(String(50), default=DependencyState.READY.value, nullable=False)
    
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    duration_days = Column(Integer, nullable=False)
    position = Column(Integer, default=0)

    prerequisites = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.dependent_id",
        back_populates="dependent",
        cascade="all, delete-orphan"
    )

    dependents = relationship(
        "TaskDependency",
        foreign_keys="TaskDependency.prerequisite_id",
        back_populates="prerequisite",
        cascade="all, delete-orphan"
    )

class TaskDependency(Base):
    __tablename__ = "task_dependencies"

    id = Column(Integer, primary_key=True, index=True)
    prerequisite_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    dependent_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)

    prerequisite = relationship("Task", foreign_keys=[prerequisite_id], back_populates="dependents")
    dependent = relationship("Task", foreign_keys=[dependent_id], back_populates="prerequisites")

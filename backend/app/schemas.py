from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date
from enum import Enum

class TaskStatusEnum(str, Enum):
    BACKLOG = "Backlog"
    IN_PROGRESS = "In Progress"
    REVIEW = "Review"
    DONE = "Done"

class DependencyStateEnum(str, Enum):
    READY = "Ready"
    BLOCKED = "Blocked"

class DependencyBase(BaseModel):
    prerequisite_id: int
    dependent_id: int

class DependencyCreate(DependencyBase):
    pass

class DependencyOut(DependencyBase):
    id: int

    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    title: str = Field(..., max_length=255)
    description: Optional[str] = None
    duration_days: int = Field(..., gt=0)
    start_date: date
    status: TaskStatusEnum = TaskStatusEnum.BACKLOG

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatusEnum] = None
    start_date: Optional[date] = None
    duration_days: Optional[int] = Field(None, gt=0)
    position: Optional[int] = None

class TaskOut(TaskBase):
    id: int
    end_date: date
    dependency_state: DependencyStateEnum
    position: int
    prerequisite_ids: List[int] = []
    dependent_ids: List[int] = []

    class Config:
        from_attributes = True

class DependencyProposal(BaseModel):
    prerequisite_id: int
    dependent_id: int
    reason: str

class AISuggestionResponse(BaseModel):
    proposals: List[DependencyProposal]

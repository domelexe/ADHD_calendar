from datetime import datetime
from typing import Optional
from enum import Enum

from pydantic import BaseModel


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class EisenhowerTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    urgent: bool = False
    important: bool = False
    status: TaskStatus = TaskStatus.TODO
    linked_event_id: Optional[int] = None
    due_date: Optional[datetime] = None
    target_quadrant: Optional[str] = None
    recurrence_days: Optional[int] = None


class EisenhowerTaskCreate(EisenhowerTaskBase):
    pass


class EisenhowerTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    urgent: Optional[bool] = None
    important: Optional[bool] = None
    status: Optional[TaskStatus] = None
    linked_event_id: Optional[int] = None
    due_date: Optional[datetime] = None
    target_quadrant: Optional[str] = None
    recurrence_days: Optional[int] = None


class EisenhowerTaskOut(EisenhowerTaskBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}

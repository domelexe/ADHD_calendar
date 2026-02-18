from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from app.schemas.activity_template import ActivityTemplateOut


class EventBase(BaseModel):
    title: str
    start_datetime: datetime
    end_datetime: datetime
    description: Optional[str] = None
    location: Optional[str] = None
    recurrence_rule: Optional[str] = None
    activity_template_id: Optional[int] = None
    is_background: bool = False
    color: Optional[str] = None
    icon: Optional[str] = None
    eisenhower_quadrant: Optional[str] = None

    @field_validator("end_datetime")
    @classmethod
    def end_after_start(cls, v, info):
        if "start_datetime" in info.data and v <= info.data["start_datetime"]:
            raise ValueError("end_datetime must be after start_datetime")
        return v


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    description: Optional[str] = None
    location: Optional[str] = None
    recurrence_rule: Optional[str] = None
    activity_template_id: Optional[int] = None
    is_background: Optional[bool] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    eisenhower_quadrant: Optional[str] = None


class EventOut(EventBase):
    id: int
    user_id: int
    created_at: datetime
    activity_template: Optional[ActivityTemplateOut] = None

    model_config = {"from_attributes": True}

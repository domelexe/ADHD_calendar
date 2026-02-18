from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ActivityTemplateBase(BaseModel):
    name: str
    color: str = "#6366f1"
    icon: str = "📚"
    default_duration: int = 60
    description: Optional[str] = None
    is_background: bool = False


class ActivityTemplateCreate(ActivityTemplateBase):
    pass


class ActivityTemplateUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    default_duration: Optional[int] = None
    description: Optional[str] = None
    is_background: Optional[bool] = None


class ActivityTemplateOut(ActivityTemplateBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}

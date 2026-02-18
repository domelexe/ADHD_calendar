from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models.user import User

router = APIRouter(prefix="/settings", tags=["settings"])


class UserSettings(BaseModel):
    scroll_mode: Optional[str] = "vertical"
    view_mode: Optional[str] = "dynamic"
    first_day_of_week: Optional[int] = 1
    hour_start: Optional[int] = 8
    hour_end: Optional[int] = 22


@router.get("", response_model=UserSettings)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = current_user.preferences or {}
    return UserSettings(
        scroll_mode=prefs.get("scroll_mode", "vertical"),
        view_mode=prefs.get("view_mode", "dynamic"),
        first_day_of_week=prefs.get("first_day_of_week", 1),
        hour_start=prefs.get("hour_start", 8),
        hour_end=prefs.get("hour_end", 22),
    )


@router.put("", response_model=UserSettings)
def update_settings(
    settings: UserSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prefs = dict(current_user.preferences or {})
    prefs.update(settings.model_dump(exclude_none=True))
    current_user.preferences = prefs
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return UserSettings(
        **{
            k: current_user.preferences.get(k, v)
            for k, v in settings.model_dump().items()
        }
    )

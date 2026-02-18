from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import String, Boolean, ForeignKey, DateTime, Text, Date, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class EisenhowerTask(Base):
    __tablename__ = "eisenhower_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    important: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default=TaskStatus.TODO)
    linked_event_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("events.id"), nullable=True
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    target_quadrant: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    recurrence_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="eisenhower_tasks")
    linked_event: Mapped[Optional["Event"]] = relationship(
        back_populates="eisenhower_task"
    )

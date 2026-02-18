from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    start_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_datetime: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    recurrence_rule: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    activity_template_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("activity_templates.id"), nullable=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_background: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    eisenhower_quadrant: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="events")
    activity_template: Mapped[Optional["ActivityTemplate"]] = relationship(
        back_populates="events"
    )
    eisenhower_task: Mapped[Optional["EisenhowerTask"]] = relationship(
        back_populates="linked_event"
    )

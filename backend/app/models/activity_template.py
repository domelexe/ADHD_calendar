from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ActivityTemplate(Base):
    __tablename__ = "activity_templates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="#6366f1")
    icon: Mapped[str] = mapped_column(String(50), nullable=False, default="📚")
    default_duration: Mapped[int] = mapped_column(Integer, default=60)  # minutes
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_background: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(back_populates="activity_templates")
    events: Mapped[list["Event"]] = relationship(back_populates="activity_template")

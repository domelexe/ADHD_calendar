from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AuditLog(Base):
    """
    Niemodyfikowalny log zdarzeń bezpieczeństwa.
    Zapisuje: loginy, wylogowania, zmiany hasła, operacje admina, błędy auth.
    """

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # Kto wykonał akcję (NULL = nieuwierzytelniony, np. nieudany login)
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Email w momencie zdarzenia (user może zmienić email później)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Typ zdarzenia: LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, PASSWORD_CHANGE,
    #   TOKEN_REFRESH, TOKEN_REVOKE, REGISTER, INVITE_CREATE, USER_DELETE, itd.
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Dodatkowy kontekst (np. email przy nieudanym loginie, id usuniętego usera)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Sieciowe
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    user = relationship("User", back_populates="audit_logs")

"""
Pomocnicze funkcje do zapisywania zdarzeń w audit logu.
Używane z poziomu endpointów — przekazują Request FastAPI.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


def _get_ip(request: Request) -> Optional[str]:
    """Pobiera IP klienta z nagłówka X-Forwarded-For (gdy za proxy) lub bezpośrednio."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _get_ua(request: Request) -> Optional[str]:
    return request.headers.get("User-Agent", "")[:512]


def log_event(
    db: Session,
    request: Request,
    action: str,
    user: Optional[User] = None,
    user_email: Optional[str] = None,
    detail: Optional[str] = None,
    commit: bool = False,
) -> AuditLog:
    """
    Zapisuje zdarzenie do audit_logs.

    Args:
        action:     Stały kod zdarzenia (np. LOGIN_SUCCESS, PASSWORD_CHANGE)
        user:       Obiekt usera jeśli znany
        user_email: Email (używany gdy user=None, np. nieudany login)
        detail:     Dodatkowy kontekst tekstowy
        commit:     Czy od razu commitować (domyślnie False — commit robi caller)
    """
    entry = AuditLog(
        user_id=user.id if user else None,
        user_email=(user.email if user else user_email),
        action=action,
        detail=detail,
        ip_address=_get_ip(request),
        user_agent=_get_ua(request),
        created_at=datetime.now(timezone.utc),
    )
    db.add(entry)
    if commit:
        db.commit()
    return entry


# Kody zdarzeń — stałe zamiast magicznych stringów
class AuditAction:
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILURE = "LOGIN_FAILURE"
    LOGOUT = "LOGOUT"
    REGISTER = "REGISTER"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    TOKEN_REFRESH = "TOKEN_REFRESH"
    TOKEN_REVOKE = "TOKEN_REVOKE"
    TOKEN_REVOKE_ALL = "TOKEN_REVOKE_ALL"
    INVITE_CREATE = "INVITE_CREATE"
    INVITE_DELETE = "INVITE_DELETE"
    USER_UPDATE = "USER_UPDATE"
    USER_DELETE = "USER_DELETE"

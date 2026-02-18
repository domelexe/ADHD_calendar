"""Admin endpoints — invite token management."""

import secrets
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user
from app.db.base import get_db
from app.models.invite_token import InviteToken
from app.models.user import User
from app.schemas.user import InviteTokenBatchCreate, InviteTokenOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/invite-tokens", response_model=List[InviteTokenOut])
def create_invite_tokens(
    payload: InviteTokenBatchCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Generuje 1–100 jednorazowych tokenów zaproszeń."""
    count = max(1, min(100, payload.count))
    tokens = []
    for _ in range(count):
        token = InviteToken(
            token=secrets.token_urlsafe(32),
            created_at=datetime.now(timezone.utc),
        )
        db.add(token)
        tokens.append(token)
    db.commit()
    for t in tokens:
        db.refresh(t)
    return tokens


@router.get("/invite-tokens", response_model=List[InviteTokenOut])
def list_invite_tokens(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Lista wszystkich tokenów (dla admina)."""
    return db.query(InviteToken).order_by(InviteToken.created_at.desc()).all()

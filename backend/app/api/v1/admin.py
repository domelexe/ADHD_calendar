"""Admin endpoints — user management and invite token management."""

import secrets
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user
from app.core.audit import AuditAction, log_event
from app.core.security import get_password_hash, validate_password_strength
from app.db.base import get_db
from app.models.audit_log import AuditLog
from app.models.invite_token import InviteToken
from app.models.user import User
from app.schemas.user import (
    AdminUpdateUser,
    AuditLogOut,
    InviteTokenBatchCreate,
    InviteTokenOut,
    UserOutAdmin,
)

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Invite tokens ──────────────────────────────────────────────────────────────


@router.post("/invite-tokens", response_model=List[InviteTokenOut])
def create_invite_tokens(
    request: Request,
    payload: InviteTokenBatchCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
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
    log_event(
        db,
        request,
        action=AuditAction.INVITE_CREATE,
        user=admin,
        detail=f"count={count}",
        commit=True,
    )
    return tokens


@router.get("/invite-tokens", response_model=List[InviteTokenOut])
def list_invite_tokens(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Lista wszystkich tokenów (dla admina)."""
    return db.query(InviteToken).order_by(InviteToken.created_at.desc()).all()


@router.delete("/invite-tokens/{token}", status_code=204)
def delete_invite_token(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Usuwa token zaproszenia (tylko nieużyty)."""
    invite = db.query(InviteToken).filter(InviteToken.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Token not found")
    if invite.used:
        raise HTTPException(status_code=400, detail="Cannot delete used token")
    db.delete(invite)
    db.commit()
    log_event(
        db,
        request,
        action=AuditAction.INVITE_DELETE,
        user=admin,
        detail=f"token={token[:8]}…",
        commit=True,
    )


# ── Users ──────────────────────────────────────────────────────────────────────


@router.get("/users", response_model=List[UserOutAdmin])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Lista wszystkich użytkowników."""
    return db.query(User).order_by(User.created_at).all()


@router.patch("/users/{user_id}", response_model=UserOutAdmin)
def update_user(
    user_id: int,
    request: Request,
    payload: AdminUpdateUser,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Zmiana emaila, uprawnień lub hasła użytkownika."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    changes = []

    if payload.email is not None:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Email already in use")
        changes.append(f"email:{user.email}->{payload.email}")
        user.email = payload.email

    if payload.is_admin is not None:
        if user_id == admin.id and not payload.is_admin:
            raise HTTPException(
                status_code=400, detail="Cannot remove your own admin privileges"
            )
        changes.append(f"is_admin:{user.is_admin}->{payload.is_admin}")
        user.is_admin = payload.is_admin

    if payload.new_password is not None:
        pw_error = validate_password_strength(payload.new_password)
        if pw_error:
            raise HTTPException(status_code=400, detail=pw_error)
        user.hashed_password = get_password_hash(payload.new_password)
        changes.append("password_reset")

    db.commit()
    db.refresh(user)
    log_event(
        db,
        request,
        action=AuditAction.USER_UPDATE,
        user=admin,
        detail=f"user_id={user_id} changes={','.join(changes)}",
        commit=True,
    )
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Usuwa użytkownika i wszystkie jego dane."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    email = user.email
    db.delete(user)
    db.commit()
    log_event(
        db,
        request,
        action=AuditAction.USER_DELETE,
        user=admin,
        detail=f"deleted_email={email}",
        commit=True,
    )


# ── Audit log ─────────────────────────────────────────────────────────────────


@router.get("/audit-log", response_model=List[AuditLogOut])
def get_audit_log(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Ostatnie zdarzenia audit logu (max 100 na raz)."""
    return (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(min(limit, 200))
        .all()
    )
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


@router.delete("/invite-tokens/{token}", status_code=204)
def delete_invite_token(
    token: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Usuwa token zaproszenia (tylko nieużyty)."""
    invite = db.query(InviteToken).filter(InviteToken.token == token).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Token not found")
    if invite.used:
        raise HTTPException(status_code=400, detail="Cannot delete used token")
    db.delete(invite)
    db.commit()


# ── Users ──────────────────────────────────────────────────────────────────────


@router.get("/users", response_model=List[UserOutAdmin])
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    """Lista wszystkich użytkowników."""
    return db.query(User).order_by(User.created_at).all()


@router.patch("/users/{user_id}", response_model=UserOutAdmin)
def update_user(
    user_id: int,
    payload: AdminUpdateUser,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Zmiana emaila, uprawnień lub hasła użytkownika."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email is not None:
        # Sprawdź czy email nie jest zajęty przez kogoś innego
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = payload.email

    if payload.is_admin is not None:
        # Nie można odebrać admina samemu sobie
        if user_id == admin.id and not payload.is_admin:
            raise HTTPException(
                status_code=400, detail="Cannot remove your own admin privileges"
            )
        user.is_admin = payload.is_admin

    if payload.new_password is not None:
        if len(payload.new_password) < 8:
            raise HTTPException(
                status_code=400, detail="Password must be at least 8 characters"
            )
        user.hashed_password = get_password_hash(payload.new_password)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """Usuwa użytkownika i wszystkie jego dane."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()

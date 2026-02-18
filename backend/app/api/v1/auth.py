from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import verify_password, create_access_token, get_password_hash
from app.db.base import get_db
from app.models.invite_token import InviteToken
from app.models.user import User
from app.api.deps import get_current_user
from app.schemas.user import ChangePassword, Token, UserOut, UserRegister

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/token", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token({"sub": str(user.id)})
    return Token(access_token=access_token)


@router.post("/register", response_model=UserOut, status_code=201)
def register(
    payload: UserRegister,
    db: Session = Depends(get_db),
):
    # Sprawdź token zaproszenia
    invite = (
        db.query(InviteToken)
        .filter(
            InviteToken.token == payload.invite_token,
            InviteToken.used == False,  # noqa: E712
        )
        .first()
    )
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used invite token",
        )

    # Sprawdź czy email nie jest już zajęty
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Utwórz użytkownika
    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.flush()

    # Oznacz token jako użyty
    invite.used = True
    invite.used_by_user_id = user.id
    invite.used_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", status_code=204)
def change_password(
    payload: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters",
        )
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()

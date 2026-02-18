from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    invite_token: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    is_admin: bool = False

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPair(BaseModel):
    """Zwracany przy logowaniu — access + refresh token."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class InviteTokenOut(BaseModel):
    token: str
    used: bool
    created_at: datetime
    used_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InviteTokenBatchCreate(BaseModel):
    count: int = 1  # ile tokenów wygenerować (1–100)


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class AdminUpdateUser(BaseModel):
    email: Optional[str] = None
    is_admin: Optional[bool] = None
    new_password: Optional[str] = None


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_email: Optional[str] = None
    action: str
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserOutAdmin(BaseModel):
    id: int
    email: str
    is_admin: bool
    created_at: datetime

    model_config = {"from_attributes": True}

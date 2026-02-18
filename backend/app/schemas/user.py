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


class InviteTokenOut(BaseModel):
    token: str
    used: bool
    created_at: datetime
    used_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InviteTokenBatchCreate(BaseModel):
    count: int = 1  # ile tokenów wygenerować (1–100)

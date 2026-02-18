import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# Długość access tokena: krótka (15 min) — odświeżany przez refresh token
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode(), salt).decode()


def validate_password_strength(password: str) -> Optional[str]:
    """
    Zwraca komunikat błędu jeśli hasło jest za słabe, None jeśli OK.
    Wymagania:
      - min. 8 znaków
      - min. 1 cyfra
      - min. 1 znak specjalny (!@#$%^&*...)
      - min. 1 wielka litera
    """
    if len(password) < 8:
        return "Hasło musi mieć co najmniej 8 znaków"
    if not re.search(r"[A-Z]", password):
        return "Hasło musi zawierać co najmniej jedną wielką literę"
    if not re.search(r"\d", password):
        return "Hasło musi zawierać co najmniej jedną cyfrę"
    if not re.search(r"[!@#$%^&*()\-_=+\[\]{};:'\",.<>?/\\|`~]", password):
        return "Hasło musi zawierać co najmniej jeden znak specjalny"
    return None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token_str() -> str:
    """Generuje losowy, kryptograficznie bezpieczny refresh token."""
    return secrets.token_urlsafe(64)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

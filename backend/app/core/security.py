# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Password hashing (bcrypt) and JWT access-token helpers."""

from __future__ import annotations

import datetime as dt
from typing import Any, Dict

import bcrypt
import jwt

from app.core.config import get_settings


def hash_password(plain: str) -> str:
    """Hash a password with bcrypt; returns a ``$2b$`` salt+hash string."""
    if not plain:
        raise ValueError("Password must not be empty")
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(plain: str, password_hash: str) -> bool:
    """Constant-time password verification against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


def create_access_token(*, user_id: str, email: str, role: str) -> str:
    """Issue a signed, short-lived JWT access token."""
    settings = get_settings()
    now = dt.datetime.now(dt.timezone.utc)
    payload: Dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + dt.timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT; raises ``jwt.PyJWTError`` on failure."""
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])

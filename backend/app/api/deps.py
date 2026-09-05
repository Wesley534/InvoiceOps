# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""FastAPI dependencies: current user, role guards, pagination, DB session."""

from __future__ import annotations

from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)

_settings = get_settings()


def _credentials_exc(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the bearer token."""
    if credentials is None:
        raise _credentials_exc("Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise _credentials_exc("Invalid or expired token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise _credentials_exc("Token missing subject")

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _credentials_exc("User no longer active")

    # Role claim must match the stored role (roles are not client-supplied).
    if payload.get("role") != user.role:
        raise _credentials_exc("Token role mismatch")
    return user


def _require_roles(*roles: UserRole):
    """Build a dependency that enforces a role allowlist server-side."""

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in {role.value for role in roles}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Requires role(s): {', '.join(r.value for r in roles)}. "
                    f"Your role: {current_user.role}"
                ),
            )
        return current_user

    return dependency


require_reviewer = _require_roles(UserRole.REVIEWER, UserRole.APPROVER)
require_approver = _require_roles(UserRole.APPROVER)

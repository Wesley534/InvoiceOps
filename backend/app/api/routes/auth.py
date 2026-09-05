# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Authentication endpoints: login, open self-registration, and user management.

Registration policy:
- POST /auth/register is open (no token needed) but only ever creates
  ``reviewer`` accounts. The approver role is never self-assigned.
- The seeded approver is provisioned from the SEED_APPROVER_* environment
  variables by ``python -m app.initial_data`` (run on first container start).
- Approvers can additionally create or promote users of either role through
  the approver-only management endpoints below.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_approver
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    AdminUserCreateRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
    UserResponse,
    UserUpdateRequest,
)
from app.schemas.common import PageOut
from app.services.audit import write_audit

router = APIRouter(tags=["auth"])


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=409, detail=detail)


def _issue_token(db: Session, user: User) -> TokenResponse:
    settings = get_settings()
    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    return TokenResponse(
        access_token=token,
        role=user.role,
        name=user.name,
        expires_in_seconds=settings.access_token_expire_minutes * 60,
    )


@router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    settings = get_settings()
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))

    valid = user is not None and user.is_active and verify_password(payload.password, user.password_hash)
    if not valid:
        write_audit(
            db,
            action="auth.login_failed",
            actor_email=email,
            detail={"reason": "invalid_credentials"},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token(user_id=user.id, email=user.email, role=user.role)
    write_audit(db, action="auth.login_success", actor=user)
    db.commit()
    return TokenResponse(
        access_token=token,
        role=user.role,
        name=user.name,
        expires_in_seconds=settings.access_token_expire_minutes * 60,
    )


@router.post("/auth/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Open self-registration. Always creates a reviewer; the role claim is
    hard-coded server-side so no caller can request approver privileges."""
    email = payload.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise _conflict("An account with email %s already exists." % email)

    user = User(
        email=email,
        name=payload.name.strip(),
        password_hash=hash_password(payload.password),
        role=UserRole.REVIEWER.value,
    )
    db.add(user)
    db.flush()
    write_audit(
        db,
        action="auth.register",
        actor=user,
        detail={"role": user.role, "source": "self_service"},
    )
    db.commit()
    db.refresh(user)
    return _issue_token(db, user)


@router.get("/auth/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


# ============================================================================
# Approver-gated user management
# ============================================================================
@router.get("/auth/users", response_model=PageOut[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_approver),
    q: Optional[str] = Query(default=None, description="Substring filter on email or name"),
    role: Optional[str] = Query(default=None, pattern="^(reviewer|approver)$"),
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
) -> PageOut[UserOut]:
    conditions = []
    search = q.strip() if q else None
    if search:
        pattern = "%" + search + "%"
        conditions.append(or_(User.email.ilike(pattern), User.name.ilike(pattern)))
    if role:
        conditions.append(User.role == role)
    total = db.scalar(select(func.count()).select_from(User).where(*conditions)) or 0
    rows = db.scalars(
        select(User)
        .where(*conditions)
        .order_by(User.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    items = [UserOut.model_validate(u) for u in rows]
    return PageOut[UserOut](
        items=items, total=total, page=page, size=size,
        pages=(total + size - 1) // size, count=len(items), search=search,
    )


@router.post("/auth/users", response_model=UserResponse, status_code=201)
def create_user(
    payload: AdminUserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approver),
) -> User:
    """Approver-only user provisioning with an explicit role (reviewer or
    approver). This is the API counterpart to the env-seeded approver."""
    email = payload.email.lower().strip()
    if db.scalar(select(User).where(User.email == email)):
        raise _conflict("An account with email %s already exists." % email)

    user = User(
        email=email,
        name=payload.name.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.flush()
    write_audit(
        db,
        action="auth.user.created",
        actor=current_user,
        detail={"email": user.email, "role": user.role},
    )
    db.commit()
    db.refresh(user)
    return user


@router.patch("/auth/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approver),
) -> User:
    """Approver-only user update: role changes, credential resets, deactivation."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot edit your own account here.")

    changes = []
    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        candidate = data["email"].lower().strip()
        clash = db.scalar(select(User).where(User.email == candidate, User.id != user.id))
        if clash is not None:
            raise _conflict("Another account already uses email %s." % candidate)
        if user.email != candidate:
            user.email = candidate
            changes.append("email")
    if "name" in data and data["name"] is not None and user.name != data["name"].strip():
        user.name = data["name"].strip()
        changes.append("name")
    if "role" in data and data["role"] is not None and user.role != data["role"]:
        user.role = data["role"]
        changes.append("role")
    if "password" in data and data["password"] is not None:
        if not verify_password(data["password"], user.password_hash):
            user.password_hash = hash_password(data["password"])
            changes.append("password")
    if "is_active" in data and data["is_active"] is not None and user.is_active != data["is_active"]:
        user.is_active = data["is_active"]
        changes.append("is_active")

    if not changes:
        return user
    write_audit(
        db,
        action="auth.user.updated",
        actor=current_user,
        detail={"user_id": user.id, "fields": sorted(changes)},
    )
    db.commit()
    db.refresh(user)
    return user

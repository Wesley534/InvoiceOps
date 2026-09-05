# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Pydantic schemas for authentication and users."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class RegisterRequest(BaseModel):
    """Open self-registration. Role is always reviewer by design: the approver
    role is provisioned by the operator (seed env vars) or an approver-only
    admin endpoint, never self-assigned."""

    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=256)


class AdminUserCreateRequest(RegisterRequest):
    """Approver-gated user creation with an explicit role."""

    role: str = Field(pattern="^(reviewer|approver)$")


class UserUpdateRequest(BaseModel):
    """Approver-gated user update: every field is optional, provided fields
    are applied. A password, when supplied, resets the stored hash."""

    email: Optional[EmailStr] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    password: Optional[str] = Field(default=None, min_length=8, max_length=256)
    role: Optional[str] = Field(default=None, pattern="^(reviewer|approver)$")
    is_active: Optional[bool] = None



class TokenResponse(BaseModel):
    success: bool = True
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    expires_in_seconds: int


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    name: str
    role: str
    is_active: bool
    created_at: datetime


class UserResponse(UserOut):
    """User resource as a single-object API response (root-level success flag;
    row objects inside /auth/users lists stay bare ``UserOut``)."""

    success: bool = True

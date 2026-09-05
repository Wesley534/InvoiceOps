# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""User model: login identity with a reviewer/approver role."""

from __future__ import annotations

from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UuidPkMixin
from app.models.enums import UserRole

if TYPE_CHECKING:
    from app.models.audit import AuditEvent
    from app.models.decision import DecisionRecord
    from app.models.invoice import Invoice


class User(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default=UserRole.REVIEWER.value)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    decisions: Mapped[List["DecisionRecord"]] = relationship(back_populates="user")
    audit_events: Mapped[List["AuditEvent"]] = relationship(back_populates="user")
    submitted_invoices: Mapped[List["Invoice"]] = relationship(
        back_populates="submitted_by"
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<User email={self.email!r} role={self.role!r}>"

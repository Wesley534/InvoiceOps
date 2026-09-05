# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Invoice model: one workflow item per submitted PDF."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UuidPkMixin, utcnow
from app.models.enums import InvoiceStatus

if TYPE_CHECKING:
    from app.models.audit import AuditEvent
    from app.models.extraction import ExtractionRecord
    from app.models.job import Job
    from app.models.user import User
    from app.models.validation import ValidationRun


class Invoice(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "invoices"

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(32), default=InvoiceStatus.RECEIVED.value, index=True, nullable=False
    )
    case_id: Mapped[Optional[str]] = mapped_column(String(32), index=True, nullable=True)

    submitted_by_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    submitted_by: Mapped[Optional["User"]] = relationship(back_populates="submitted_invoices")
    jobs: Mapped[List["Job"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", order_by="Job.created_at"
    )
    extraction: Mapped[Optional["ExtractionRecord"]] = relationship(
        back_populates="invoice", uselist=False, cascade="all, delete-orphan"
    )
    validation_runs: Mapped[List["ValidationRun"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )
    audit_events: Mapped[List["AuditEvent"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Invoice id={self.id!r} status={self.status!r}>"

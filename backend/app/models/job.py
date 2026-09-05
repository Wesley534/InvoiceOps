# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Job model: database-backed async wrapper the UI polls for progress."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UuidPkMixin
from app.models.enums import JobStage, JobStatus

if TYPE_CHECKING:
    from app.models.invoice import Invoice
    from app.models.validation import ValidationRun


class Job(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "jobs"

    invoice_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("invoices.id", ondelete="CASCADE"), index=True, nullable=False
    )
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), default=JobStatus.QUEUED.value, index=True, nullable=False
    )
    stage: Mapped[str] = mapped_column(
        String(32), default=JobStage.QUEUED.value, nullable=False
    )
    progress_pct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    invoice: Mapped["Invoice"] = relationship(back_populates="jobs")
    validation_run: Mapped[Optional["ValidationRun"]] = relationship(
        back_populates="job", uselist=False
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Job id={self.id!r} status={self.status!r}>"

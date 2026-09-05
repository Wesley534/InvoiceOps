# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""ValidationRun model: freezes the checks and report behind a decision."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from app.models.decision import DecisionRecord
    from app.models.invoice import Invoice
    from app.models.job import Job


class ValidationRun(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "validation_runs"

    invoice_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("invoices.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    job_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("jobs.id", ondelete="SET NULL"), index=True, nullable=True
    )
    report_id: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    decision: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    confidence: Mapped[str] = mapped_column(String(8), nullable=False)
    schema_version: Mapped[str] = mapped_column(String(8), nullable=False, default="1.0")
    report_json: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    checks_json: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    processing_time_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    invoice: Mapped["Invoice"] = relationship(back_populates="validation_runs")
    job: Mapped[Optional["Job"]] = relationship(back_populates="validation_run")
    decision_record: Mapped[Optional["DecisionRecord"]] = relationship(
        back_populates="validation_run", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<ValidationRun report_id={self.report_id!r} decision={self.decision!r}>"

# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Extraction model: what was extracted from a PDF and how.

The full, contract-validated extraction object is stored as JSON so the
schema can evolve without migrations; only audit-relevant metadata is
columnar.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import utcnow

from app.db.base import Base, TimestampMixin, UuidPkMixin

if TYPE_CHECKING:
    from app.models.invoice import Invoice
    from app.models.job import Job


class ExtractionRecord(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "extractions"

    invoice_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("invoices.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    job_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True
    )
    method: Mapped[str] = mapped_column(String(32), nullable=False)
    extraction_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_call_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    corrected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=True
    )

    invoice: Mapped["Invoice"] = relationship(back_populates="extraction")
    job: Mapped[Optional["Job"]] = relationship()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<ExtractionRecord invoice={self.invoice_id!r} method={self.method!r}>"

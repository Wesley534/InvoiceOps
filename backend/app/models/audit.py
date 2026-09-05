# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""AuditEvent model: append-only log of every meaningful action.

Logged per run: auth events, job lifecycle, stage timings, extraction method,
corrections, and human decisions. Satisfies records-retention requirements.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UuidPkMixin, utcnow

if TYPE_CHECKING:
    from app.models.invoice import Invoice
    from app.models.user import User


class AuditEvent(UuidPkMixin, Base):
    __tablename__ = "audit_events"

    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, index=True, nullable=False
    )
    actor_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    action: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    detail: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    user_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    invoice_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("invoices.id", ondelete="SET NULL"), index=True, nullable=True
    )
    job_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True
    )

    user: Mapped[Optional["User"]] = relationship(back_populates="audit_events")
    invoice: Mapped[Optional["Invoice"]] = relationship(back_populates="audit_events")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<AuditEvent action={self.action!r}>"

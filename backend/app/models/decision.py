# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""DecisionRecord model: the append-only human approval gate (Stage 6).

Records are created once per validation run and never updated or deleted.
"""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UuidPkMixin
from app.models.enums import HumanOutcome

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.validation import ValidationRun


class DecisionRecord(UuidPkMixin, Base):
    __tablename__ = "decisions"

    record_id: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    validation_run_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("validation_runs.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    report_id: Mapped[str] = mapped_column(String(16), nullable=False)
    invoice_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    vendor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    system_decision: Mapped[str] = mapped_column(String(16), nullable=False)
    human_outcome: Mapped[str] = mapped_column(
        String(24), default=HumanOutcome.PENDING.value, nullable=False
    )
    decided_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    decided_by_id: Mapped[Optional[str]] = mapped_column(
        String(32), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    decided_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    override_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    validation_run: Mapped["ValidationRun"] = relationship(back_populates="decision_record")
    user: Mapped[Optional["User"]] = relationship(back_populates="decisions")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<DecisionRecord record_id={self.record_id!r} outcome={self.human_outcome!r}>"

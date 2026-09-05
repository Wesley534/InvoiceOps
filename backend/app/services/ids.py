# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Human-facing sequence ids for reports (RPT-YYYY-NNNN) and decisions
(DEC-YYYY-NNNN), matching the JSON Schema patterns in contracts/.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.decision import DecisionRecord
from app.models.validation import ValidationRun

_PATTERN = "RPT-%s-%04d"
_YEAR = "%Y"


def _year() -> str:
    return datetime.now(timezone.utc).strftime(_YEAR)


def next_report_id(db: Session) -> str:
    year = _year()
    count = db.scalar(
        select(func.count())
        .select_from(ValidationRun)
        .where(ValidationRun.report_id.like(f"RPT-{year}-%"))
    ) or 0
    return _PATTERN % (year, int(count) + 1)


def next_decision_record_id(db: Session) -> str:
    year = _year()
    count = db.scalar(
        select(func.count())
        .select_from(DecisionRecord)
        .where(DecisionRecord.record_id.like(f"DEC-{year}-%"))
    ) or 0
    return "DEC-%s-%04d" % (year, int(count) + 1)

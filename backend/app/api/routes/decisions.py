# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Decision endpoint: the human approval gate (approver role only)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_approver
from app.db.session import get_db
from app.models.user import User
from app.models.validation import ValidationRun
from app.schemas.decision import DecisionOut, DecideRequest
from app.services.decisions import DecisionError, record_decision

router = APIRouter(tags=["decisions"])


@router.post("/decide", response_model=DecisionOut)
def decide(
    payload: DecideRequest,
    db: Session = Depends(get_db),
    approver: User = Depends(require_approver),
) -> DecisionOut:
    run = db.get(ValidationRun, payload.report_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        record = record_decision(
            db,
            run=run,
            approver=approver,
            outcome=payload.outcome,
            override_reason=payload.override_reason,
            notes=payload.notes,
        )
    except DecisionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return DecisionOut(
        id=record.id,
        record_id=record.record_id,
        report_id=record.report_id,
        validation_run_id=record.validation_run_id,
        invoice_number=record.invoice_number,
        vendor=record.vendor,
        system_decision=record.system_decision,
        human_outcome=record.human_outcome,
        decided_by=record.decided_by,
        decided_at=record.decided_at,
        override_reason=record.override_reason,
        notes=record.notes,
    )

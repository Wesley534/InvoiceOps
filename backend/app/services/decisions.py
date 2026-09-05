# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Human approval gate (Stage 6): approver decide / BLOCK override.

Append-only: one decision per validation run; records are never updated or
deleted. A BLOCK can only proceed through a documented override.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.decision import DecisionRecord
from app.models.enums import HumanOutcome, InvoiceStatus
from app.models.invoice import Invoice
from app.models.user import User
from app.models.validation import ValidationRun
from app.services import ids
from app.services.audit import write_audit


class DecisionError(RuntimeError):
    """Raised when a decide request violates policy/state rules."""


def _report_field(run: ValidationRun, key: str) -> Optional[str]:
    value = (run.report_json.get("extraction", {}).get("fields", {}).get(key) or {}).get("value")
    return str(value) if value else None


def record_decision(
    db: Session,
    *,
    run: ValidationRun,
    approver: User,
    outcome: str,  # 'approved' | 'rejected'
    override_reason: Optional[str] = None,
    notes: Optional[str] = None,
) -> DecisionRecord:
    """Record one human decision for a validation run."""
    if run.decision_record is not None:
        raise DecisionError("A decision is already recorded for report %s" % run.report_id)

    invoice = db.get(Invoice, run.invoice_id)
    if invoice is None:
        raise DecisionError("Invoice for report %s does not exist" % run.report_id)
    if invoice.status not in (InvoiceStatus.AWAITING_REVIEW.value, InvoiceStatus.BLOCKED.value):
        raise DecisionError(
            "Invoice %s is in state %s; only AWAITING_REVIEW or BLOCKED invoices "
            "can be decided." % (invoice.id, invoice.status)
        )

    system_decision = run.decision  # PASS | REVIEW | BLOCK

    if system_decision == "BLOCK" and outcome == "approved":
        if not override_reason or not override_reason.strip():
            raise DecisionError(
                "Overriding a BLOCK requires a written override_reason."
            )
        human_outcome = HumanOutcome.OVERRIDE_BLOCK.value
    else:
        human_outcome = HumanOutcome(outcome).value

    record = DecisionRecord(
        record_id=ids.next_decision_record_id(db),
        validation_run_id=run.id,
        report_id=run.report_id,
        invoice_number=_report_field(run, "invoice_number"),
        vendor=_report_field(run, "vendor_name"),
        system_decision=system_decision,
        human_outcome=human_outcome,
        decided_by=approver.email,
        decided_by_id=approver.id,
        decided_at=datetime.now(timezone.utc),
        override_reason=(override_reason or "").strip() or None,
        notes=(notes or "").strip() or None,
    )
    db.add(record)

    invoice.status = InvoiceStatus.COMPLETED.value
    db.add(invoice)
    write_audit(
        db,
        action="decision.recorded",
        actor=approver,
        invoice_id=invoice.id,
        detail={
            "record_id": record.record_id,
            "report_id": run.report_id,
            "system_decision": system_decision,
            "human_outcome": human_outcome,
            "override": bool(record.override_reason),
        },
    )
    db.commit()
    db.refresh(record)
    return record

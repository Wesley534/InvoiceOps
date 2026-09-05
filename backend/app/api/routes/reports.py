# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Report endpoints: view a validation report, correct extraction (G1),
and export the report as Markdown."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_reviewer
from app.db.session import get_db
from app.models.enums import InvoiceStatus
from app.models.extraction import ExtractionRecord
from app.models.user import User
from app.models.validation import ValidationRun
from app.schemas.report import (
    ExtractionPatchRequest,
    ExtractionPatchResponse,
    ReportOut,
    ReportResponse,
)
from app.services.audit import write_audit
from app.services.extraction.deterministic import FIELD_KEYS, canonical_money
from app.services.pipeline import PipelineError, revalidate_extraction
from app.services.report_builder import build_report_markdown

router = APIRouter(tags=["reports"])


def _load_run(db: Session, run_id: str) -> ValidationRun:
    run = db.scalar(
        select(ValidationRun)
        .where(ValidationRun.id == run_id)
        .options(
            selectinload(ValidationRun.invoice),
            selectinload(ValidationRun.decision_record),
        )
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return run


def _to_report_out(run: ValidationRun) -> ReportOut:
    invoice_status = run.invoice.status if run.invoice else None
    outcome = run.decision_record.human_outcome if run.decision_record else None
    return ReportOut(
        id=run.id,
        invoice_id=run.invoice_id,
        job_id=run.job_id,
        report_id=run.report_id,
        decision=run.decision,
        confidence=run.confidence,
        invoice_status=invoice_status,
        human_outcome=outcome,
        created_at=run.created_at,
        report=run.report_json,
    )


@router.get("/reports/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> ReportOut:
    return _to_report_out(_load_run(db, report_id))


@router.get("/reports/{report_id}/markdown")
def get_report_markdown(
    report_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> Response:
    run = _load_run(db, report_id)
    text = build_report_markdown(run.report_json)
    return Response(
        content=text,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="%s.md"' % run.report_id
        },
    )


@router.patch(
    "/reports/{report_id}/extraction", response_model=ExtractionPatchResponse
)
def patch_extraction(
    report_id: str,
    payload: ExtractionPatchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> ExtractionPatchResponse:
    """Human correction of extracted fields (gate G1).

    Only fields already extracted can be corrected. After the correction the
    report is re-validated and its decision updated in place.
    """
    run = _load_run(db, report_id)
    invoice = run.invoice
    if invoice is not None and invoice.status == InvoiceStatus.COMPLETED.value:
        raise HTTPException(
            status_code=409,
            detail="This invoice is COMPLETED; its decision is final.",
        )

    extraction = dict(run.report_json.get("extraction", {}))
    fields = dict(extraction.get("fields", {}))
    for key, patch in payload.fields.items():
        if key not in FIELD_KEYS:
            raise HTTPException(
                status_code=422,
                detail="Unknown extraction field: %r. Allowed: %s"
                % (key, ", ".join(FIELD_KEYS)),
            )
        existing = fields.get(key) or {"value": None, "confidence": "missing", "source": "derived"}
        value = patch.value
        if key in ("subtotal", "tax_amount", "total_amount") and value is not None:
            canonical = canonical_money(value)
            if canonical is None:
                raise HTTPException(
                    status_code=422,
                    detail="Field %r must be a decimal amount like '1234.56'." % key,
                )
            value = canonical
        elif key == "invoice_date" and value is not None:
            from app.services.extraction.deterministic import parse_date

            iso = parse_date(value)
            if iso is None:
                raise HTTPException(
                    status_code=422,
                    detail="invoice_date must parse to YYYY-MM-DD; got %r." % value,
                )
            value = iso
        fields[key] = {
            "value": value,
            "confidence": "high",
            "source": existing.get("source", "derived"),
        }
        extraction["extraction_issues"] = list(extraction.get("extraction_issues", []))
    extraction["fields"] = fields

    # Persist the corrected extraction on the extraction record.
    record = db.scalar(
        select(ExtractionRecord).where(ExtractionRecord.invoice_id == run.invoice_id)
    )
    if record is not None:
        from app.db.base import utcnow

        record.extraction_json = extraction
        record.corrected_at = utcnow()
        db.add(record)
    write_audit(
        db,
        action="extraction.patch_requested",
        actor=current_user,
        invoice_id=run.invoice_id,
        job_id=run.job_id,
        detail={"report_id": run.report_id, "fields": sorted(payload.fields)},
    )
    db.commit()

    try:
        new_run = revalidate_extraction(db, run.id, extraction)
    except PipelineError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return ExtractionPatchResponse(report=_to_report_out(new_run), revalidated=True)

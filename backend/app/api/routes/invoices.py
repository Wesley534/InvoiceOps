# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Invoice endpoints: upload (multipart PDF), queue/history, retry."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_reviewer
from app.core.config import get_settings
from app.db.session import get_db
from app.models.enums import InvoiceStatus
from app.models.invoice import Invoice
from app.models.job import Job
from app.models.user import User
from app.models.validation import ValidationRun
from app.schemas.invoice import (
    InvoiceCreateResponse,
    InvoiceDetail,
    InvoiceListItem,
    InvoiceListResponse,
    JobSummary,
    RunSummary,
)
from app.services.audit import write_audit
from app.services.extraction.deterministic import case_id_from_filename
from app.services.pipeline import enqueue_job

logger = logging.getLogger(__name__)

router = APIRouter(tags=["invoices"])


class InvalidUploadError(RuntimeError):
    """Raised when an uploaded file fails intake validation."""


def _read_upload(upload: UploadFile, max_bytes: int) -> bytes:
    """Read the uploaded file, enforcing the size limit."""
    chunks = []
    total = 0
    upload.file.seek(0)
    while True:
        chunk = upload.file.read(1024 * 256)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise InvalidUploadError(
                "Upload exceeds the %d MB limit." % (max_bytes // (1024 * 1024))
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _intake(upload: UploadFile, invoice_id: str) -> tuple[str, str]:
    """Validate the PDF, hash it, and store it under uploads/<id>.pdf."""
    settings = get_settings()
    filename = (upload.filename or "").strip()
    if not filename.lower().endswith(".pdf"):
        raise InvalidUploadError("Only PDF files are accepted.")

    content = _read_upload(upload, settings.upload_max_bytes)
    if len(content) < 5 or not content[:5].startswith(b"%PDF"):
        raise InvalidUploadError("The file is not a valid PDF (missing %PDF header).")

    file_hash = hashlib.sha256(content).hexdigest()
    upload_dir = settings.upload_path
    upload_dir.mkdir(parents=True, exist_ok=True)
    target = upload_dir / (invoice_id + ".pdf")
    target.write_bytes(content)
    return str(target), file_hash


@router.post(
    "/invoices",
    response_model=InvoiceCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_invoice(
    file: UploadFile = File(..., description="The vendor invoice PDF"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> InvoiceCreateResponse:
    invoice = Invoice(
        original_filename=(file.filename or "invoice.pdf")[:255],
        file_hash="",
        source_path="",
        case_id=case_id_from_filename(file.filename or ""),
        status=InvoiceStatus.RECEIVED.value,
        submitted_by_id=current_user.id,
    )
    db.add(invoice)
    db.flush()  # assigns invoice.id

    try:
        source_path, file_hash = _intake(file, invoice.id)
    except InvalidUploadError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:  # pragma: no cover - filesystem failure
        db.rollback()
        logger.exception("Failed to store upload")
        raise HTTPException(
            status_code=500, detail="Failed to store the uploaded PDF."
        ) from exc

    invoice.source_path = source_path
    invoice.file_hash = file_hash
    db.add(invoice)

    job = Job(invoice_id=invoice.id, attempt=1)
    db.add(job)
    db.flush()

    write_audit(
        db,
        action="invoice.uploaded",
        actor=current_user,
        invoice_id=invoice.id,
        job_id=job.id,
        detail={"filename": invoice.original_filename, "bytes": Path(source_path).stat().st_size},
    )
    db.commit()

    enqueue_job(job.id)
    logger.info("Invoice %s uploaded; job %s queued", invoice.id, job.id)
    return InvoiceCreateResponse(invoice_id=invoice.id, job_id=job.id)


def _latest_job(invoice: Invoice) -> Optional[Job]:
    return invoice.jobs[-1] if invoice.jobs else None


def _run_summary(invoice: Invoice) -> Optional[RunSummary]:
    if not invoice.validation_runs:
        return None
    run = invoice.validation_runs[-1]
    outcome = run.decision_record.human_outcome if run.decision_record else None
    return RunSummary(
        id=run.id,
        report_id=run.report_id,
        decision=run.decision,
        confidence=run.confidence,
        human_outcome=outcome,
    )


def _to_list_item(invoice: Invoice, submitted_by: Optional[str]) -> InvoiceListItem:
    job = _latest_job(invoice)
    return InvoiceListItem(
        id=invoice.id,
        case_id=invoice.case_id,
        original_filename=invoice.original_filename,
        file_hash=invoice.file_hash,
        status=invoice.status,
        received_at=invoice.received_at,
        submitted_by=submitted_by,
        job=JobSummary(
            id=job.id,
            status=job.status,
            stage=job.stage,
            progress_pct=job.progress_pct,
            error=job.error,
        )
        if job
        else None,
        run=_run_summary(invoice),
    )


@router.get("/invoices", response_model=InvoiceListResponse)
def list_invoices(
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    q: Optional[str] = Query(default=None, description="Substring filter on filename or case id"),
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
) -> InvoiceListResponse:
    filters = []
    search = q.strip() if q else None
    if status_filter:
        filters.append(Invoice.status == status_filter.upper())
    if search:
        pattern = "%" + search + "%"
        filters.append(
            or_(
                Invoice.original_filename.ilike(pattern),
                Invoice.case_id.ilike(pattern),
            )
        )

    total = db.scalar(
        select(func.count()).select_from(Invoice).where(*filters)
    ) or 0
    invoices = (
        db.execute(
            select(Invoice)
            .where(*filters)
            .options(
                selectinload(Invoice.jobs),
                selectinload(Invoice.validation_runs).selectinload(
                    ValidationRun.decision_record
                ),
            )
            .order_by(Invoice.received_at.desc(), Invoice.created_at.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
        .scalars()
        .all()
    )
    items = [_to_list_item(i, i.submitted_by.email if i.submitted_by else None) for i in invoices]
    return InvoiceListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size if total else 0,
        count=len(items),
        search=search,
    )


def _get_invoice_or_404(db: Session, invoice_id: str) -> Invoice:
    invoice = db.scalar(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(
            selectinload(Invoice.jobs),
            selectinload(Invoice.validation_runs).selectinload(
                ValidationRun.decision_record
            ),
            selectinload(Invoice.extraction),
            selectinload(Invoice.submitted_by),
        )
    )
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.get("/invoices/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> InvoiceDetail:
    invoice = _get_invoice_or_404(db, invoice_id)
    item = _to_list_item(invoice, invoice.submitted_by.email if invoice.submitted_by else None)
    data = item.model_dump()
    data["source_path"] = invoice.source_path
    data["extraction"] = (
        invoice.extraction.extraction_json if invoice.extraction else None
    )
    return InvoiceDetail(**data)


@router.post("/invoices/{invoice_id}/retry", response_model=InvoiceCreateResponse)
def retry_invoice(
    invoice_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> InvoiceCreateResponse:
    invoice = _get_invoice_or_404(db, invoice_id)
    if invoice.status == InvoiceStatus.COMPLETED.value:
        raise HTTPException(
            status_code=409,
            detail="Invoice is COMPLETED; its outcome is final and cannot be re-run.",
        )
    if not Path(invoice.source_path).exists():
        raise HTTPException(
            status_code=409,
            detail="Stored PDF is missing (%s); re-upload the invoice." % invoice.source_path,
        )

    attempt = max((j.attempt for j in invoice.jobs), default=0) + 1
    job = Job(invoice_id=invoice.id, attempt=attempt)
    db.add(job)
    db.flush()
    invoice.status = InvoiceStatus.RECEIVED.value
    db.add(invoice)
    write_audit(
        db,
        action="invoice.retry",
        actor=current_user,
        invoice_id=invoice.id,
        job_id=job.id,
        detail={"attempt": attempt},
    )
    db.commit()
    enqueue_job(job.id)
    return InvoiceCreateResponse(invoice_id=invoice.id, job_id=job.id)

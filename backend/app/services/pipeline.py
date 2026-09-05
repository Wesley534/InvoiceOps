# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Orchestrator: runs the per-invoice state machine as a background job.

Job lifecycle:  QUEUED -> RUNNING -> SUCCEEDED | FAILED
Invoice steps:  RECEIVED -> EXTRACTING -> AI_ANALYZED -> VALIDATING ->
                CLASSIFIED -> AWAITING_REVIEW | BLOCKED

Every invoice takes the same path; failures are caught, logged and written to
the job row so the UI can show the error and retry.
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.db.session import create_session
from app.models.enums import InvoiceStatus, JobStage, JobStatus
from app.models.extraction import ExtractionRecord
from app.models.invoice import Invoice
from app.models.job import Job
from app.models.validation import ValidationRun
from app.services import ids
from app.services.audit import write_audit
from app.services.contracts import ContractValidationError, validate_extraction, validate_report
from app.services.decision_engine import classify, is_extraction_reliable
from app.services.extraction.service import (
    ExtractionArtifacts,
    ExtractionError,
    extract_document,
    is_degraded,
)
from app.services.master_data import MasterData, MasterDataError
from app.services.report_builder import build_report
from app.services.validation_engine import run_checks

logger = logging.getLogger(__name__)


class PipelineError(RuntimeError):
    """Raised for configuration/state errors inside the pipeline."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _mark_job(db: Session, job: Job, *, status: JobStatus, stage: JobStage, pct: int) -> None:
    job.status = status.value
    job.stage = stage.value
    job.progress_pct = pct
    if status == JobStatus.RUNNING and job.started_at is None:
        job.started_at = _now()
    if status in (JobStatus.SUCCEEDED, JobStatus.FAILED):
        job.finished_at = _now()
    db.add(job)


def _set_invoice_status(db: Session, invoice: Invoice, status: InvoiceStatus) -> None:
    invoice.status = status.value
    db.add(invoice)


def _extraction_record(
    db: Session, invoice: Invoice, job: Job, artifacts: ExtractionArtifacts
) -> ExtractionRecord:
    """Upsert the single extraction row per invoice."""
    record = db.query(ExtractionRecord).filter(ExtractionRecord.invoice_id == invoice.id).first()
    if record is None:
        record = ExtractionRecord(invoice_id=invoice.id)
        db.add(record)
    record.job_id = job.id
    record.method = artifacts.extraction["extraction_method"]
    record.extraction_json = artifacts.extraction
    record.raw_text = artifacts.raw_text or None
    record.ai_call_id = artifacts.ai_call_id
    return record


def _remove_stale_runs(db: Session, invoice: Invoice) -> None:
    """Replace the previous validation run for this invoice (invoice: 1 run).

    A run is only replaced while no terminal human decision exists on it.
    """
    stale = db.query(ValidationRun).filter(ValidationRun.invoice_id == invoice.id).all()
    for run in stale:
        if run.decision_record is not None:
            raise PipelineError(
                "Invoice %s already has a recorded human decision; refusing to replace it."
                % invoice.id
            )
    for run in stale:
        db.delete(run)


def _store_run(
    db: Session,
    *,
    invoice: Invoice,
    job: Optional[Job],
    report: dict,
    checks,
    processing_time_ms: int,
) -> ValidationRun:
    _remove_stale_runs(db, invoice)
    run = ValidationRun(
        invoice_id=invoice.id,
        job_id=job.id if job else None,
        report_id=report["report_id"],
        decision=report["decision"],
        confidence=report["confidence"],
        schema_version=report["schema_version"],
        report_json=report,
        checks_json=checks,
        processing_time_ms=processing_time_ms,
    )
    db.add(run)
    db.flush()
    return run


def _run_pipeline(db: Session, job: Job) -> ValidationRun:
    """Execute intake -> extract -> validate -> classify -> report."""
    invoice = db.get(Invoice, job.invoice_id)
    if invoice is None:
        raise PipelineError("Job %s references a missing invoice" % job.id)

    _mark_job(db, job, status=JobStatus.RUNNING, stage=JobStage.INTAKE, pct=5)
    _set_invoice_status(db, invoice, InvoiceStatus.RECEIVED)
    write_audit(db, action="job.started", invoice_id=invoice.id, job_id=job.id,
                detail={"attempt": job.attempt})
    db.commit()

    started = time.monotonic()
    source_path = Path(invoice.source_path)

    # -- intake / extraction -------------------------------------------------
    _mark_job(db, job, status=JobStatus.RUNNING, stage=JobStage.EXTRACTING, pct=15)
    _set_invoice_status(db, invoice, InvoiceStatus.EXTRACTING)
    db.commit()

    try:
        artifacts = extract_document(source_path, source=invoice.source_path)
    except (ExtractionError, MasterDataError) as exc:
        raise PipelineError("Extraction failed: %s" % exc) from exc

    extraction = artifacts.extraction
    # Contract validation: enforcement is skipped only for degraded documents
    # that legitimately cannot satisfy minItems on line_items.
    if not artifacts.degraded:
        try:
            validate_extraction(extraction)
        except ContractValidationError:
            logger.exception("Extraction contract violation for invoice %s", invoice.id)
            raise
    else:
        logger.warning(
            "Degraded document (invoice %s): extraction skipped strict contract validation.",
            invoice.id,
        )

    _extraction_record(db, invoice, job, artifacts)
    _mark_job(db, job, status=JobStatus.RUNNING, stage=JobStage.EXTRACTING, pct=45)
    _set_invoice_status(db, invoice, InvoiceStatus.AI_ANALYZED)
    write_audit(
        db, action="extraction.completed", invoice_id=invoice.id, job_id=job.id,
        detail={
            "method": extraction["extraction_method"],
            "ai_used": artifacts.ai_used,
            "degraded": artifacts.degraded,
            "issue_count": len(extraction.get("extraction_issues", [])),
        },
    )
    db.commit()

    # -- validation -----------------------------------------------------------
    _mark_job(db, job, status=JobStatus.RUNNING, stage=JobStage.VALIDATING, pct=60)
    _set_invoice_status(db, invoice, InvoiceStatus.VALIDATING)
    db.commit()

    master = MasterData(db)
    try:
        master.require_ready()
    except MasterDataError as exc:
        # Configuration error: never silently skip a lookup.
        raise PipelineError("Master data unavailable: %s" % exc) from exc

    checks, issues = run_checks(extraction, master)

    # -- classification --------------------------------------------------------
    _mark_job(db, job, status=JobStatus.RUNNING, stage=JobStage.CLASSIFYING, pct=75)
    _set_invoice_status(db, invoice, InvoiceStatus.CLASSIFIED)
    db.commit()

    reliable = is_extraction_reliable(extraction)
    decision, confidence, human_action = classify(checks, extraction_reliable=reliable)

    # -- report ----------------------------------------------------------------
    _mark_job(db, job, status=JobStatus.RUNNING, stage=JobStage.REPORTING, pct=90)
    db.commit()

    elapsed = time.monotonic() - started
    report = build_report(
        report_id=ids.next_report_id(db),
        case_id=extraction.get("case_id") or "UNKNOWN",
        source=invoice.source_path,
        extraction=extraction,
        checks=checks,
        issues=issues,
        decision=decision,
        confidence=confidence,
        human_action_required=human_action,
        processing_time_seconds=elapsed,
        master=master,
    )
    if artifacts.degraded:
        logger.warning(
            "Degraded document (invoice %s): report skipped strict contract validation.",
            invoice.id,
        )
    else:
        try:
            validate_report(report)
        except ContractValidationError:
            logger.exception("Report contract violation for invoice %s", invoice.id)
            raise

    run = _store_run(
        db, invoice=invoice, job=job, report=report, checks=checks,
        processing_time_ms=int(elapsed * 1000),
    )

    final_status = InvoiceStatus.BLOCKED if decision == "BLOCK" else InvoiceStatus.AWAITING_REVIEW
    _set_invoice_status(db, invoice, final_status)
    _mark_job(db, job, status=JobStatus.SUCCEEDED, stage=JobStage.DONE, pct=100)
    write_audit(
        db, action="pipeline.completed", invoice_id=invoice.id, job_id=job.id,
        detail={
            "report_id": report["report_id"],
            "decision": decision,
            "confidence": confidence,
            "processing_time_ms": run.processing_time_ms,
            "failed_checks": sum(1 for c in checks if c["status"] == "fail"),
        },
    )
    db.commit()
    logger.info(
        "Pipeline completed invoice=%s decision=%s report=%s in %.1fs",
        invoice.id, decision, report["report_id"], elapsed,
    )
    return run


def _execute_job(job_id: str) -> None:
    """Background thread target: run the pipeline for one job."""
    db = create_session()
    try:
        job = db.get(Job, job_id)
        if job is None:
            logger.error("Job %s not found in background worker", job_id)
            return
        if job.status == JobStatus.RUNNING.value:
            return
        try:
            _run_pipeline(db, job)
        except Exception as exc:  # noqa: BLE001 - job-level failure boundary
            logger.exception("Job %s failed", job_id)
            invoice = db.get(Invoice, job.invoice_id)
            if invoice is not None:
                _set_invoice_status(db, invoice, InvoiceStatus.FAILED)
            job.status = JobStatus.FAILED.value
            job.stage = job.stage or JobStage.INTAKE.value
            job.error = "%s: %s" % (type(exc).__name__, exc)
            job.finished_at = _now()
            write_audit(
                db, action="job.failed", invoice_id=job.invoice_id, job_id=job.id,
                detail={"error": job.error[:2000]},
            )
            db.commit()
    finally:
        db.close()


def enqueue_job(job_id: str) -> None:
    """Start a detached worker thread for the given job id."""
    threading.Thread(target=_execute_job, args=(job_id,), name="invoice-job-%s" % job_id[:8], daemon=True).start()


# ---------------------------------------------------------------------------
# Re-validation after human field correction (gate G1)
# ---------------------------------------------------------------------------
def revalidate_extraction(
    db: Session, run_id: str, corrected_extraction: dict
) -> ValidationRun:
    """Re-run checks/classification/reporting on a corrected extraction."""
    run = db.get(ValidationRun, run_id)
    if run is None:
        raise PipelineError("Report not found: %s" % run_id)
    invoice = db.get(Invoice, run.invoice_id)
    if invoice is None:
        raise PipelineError("Invoice for report %s not found" % run_id)
    if invoice.status == InvoiceStatus.COMPLETED.value:
        raise PipelineError(
            "Invoice %s is COMPLETED; its decision is final and cannot be re-validated." % invoice.id
        )

    degraded = is_degraded(corrected_extraction)
    if not degraded:
        try:
            validate_extraction(corrected_extraction)
        except ContractValidationError:
            logger.exception("Corrected extraction violates the contract")
            raise

    started = time.monotonic()
    master = MasterData(db)
    try:
        master.require_ready()
    except MasterDataError as exc:
        # Configuration error: never silently skip a lookup.
        raise PipelineError("Master data unavailable: %s" % exc) from exc
    checks, issues = run_checks(corrected_extraction, master)
    reliable = is_extraction_reliable(corrected_extraction)
    decision, confidence, human_action = classify(checks, extraction_reliable=reliable)
    elapsed = time.monotonic() - started

    # Keep the same run row (and human-facing report_id) so report URLs stay
    # stable across corrections; the previous version remains in the audit log.
    report = build_report(
        report_id=run.report_id,
        case_id=corrected_extraction.get("case_id") or run.report_json.get("case_id") or "UNKNOWN",
        source=invoice.source_path,
        extraction=corrected_extraction,
        checks=checks,
        issues=issues,
        decision=decision,
        confidence=confidence,
        human_action_required=human_action,
        processing_time_seconds=elapsed,
        master=master,
    )
    if not degraded:
        validate_report(report)

    previous_decision = run.decision
    run.decision = decision
    run.confidence = confidence
    run.report_json = report
    run.checks_json = checks
    run.processing_time_ms = int(elapsed * 1000)
    db.add(run)

    final_status = InvoiceStatus.BLOCKED if decision == "BLOCK" else InvoiceStatus.AWAITING_REVIEW
    _set_invoice_status(db, invoice, final_status)
    write_audit(
        db, action="extraction.corrected", invoice_id=invoice.id, job_id=run.job_id,
        detail={
            "report_id": run.report_id,
            "previous_decision": previous_decision,
            "decision": decision,
            "processing_time_ms": run.processing_time_ms,
        },
    )
    db.commit()
    return run

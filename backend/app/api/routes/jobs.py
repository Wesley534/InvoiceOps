# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Job endpoints: the UI polls these for live pipeline progress."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_reviewer
from app.db.session import get_db
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobOut

router = APIRouter(tags=["jobs"])


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> JobOut:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    report_id: str | None = None
    decision: str | None = None
    if job.validation_run is not None:
        report_id = job.validation_run.id
        decision = job.validation_run.decision

    return JobOut(
        id=job.id,
        invoice_id=job.invoice_id,
        attempt=job.attempt,
        status=job.status,
        stage=job.stage,
        progress_pct=job.progress_pct,
        error=job.error,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        report_id=report_id,
        decision=decision,
    )

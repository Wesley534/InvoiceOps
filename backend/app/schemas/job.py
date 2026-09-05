# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Pydantic schemas for background jobs."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    success: bool = True
    id: str
    invoice_id: str
    attempt: int
    status: str
    stage: str
    progress_pct: int
    error: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    # Populated when the job finished: the id of the resulting report.
    report_id: Optional[str] = None
    decision: Optional[str] = None

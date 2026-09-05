# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Pydantic schemas for invoices."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class InvoiceCreateResponse(BaseModel):
    """Response after upload/retry: the created ids. No refetch needed to
    start polling the job."""

    success: bool = True
    invoice_id: str
    job_id: str


class JobSummary(BaseModel):
    id: str
    status: str
    stage: str
    progress_pct: int
    error: Optional[str] = None


class RunSummary(BaseModel):
    id: str
    report_id: str
    decision: str
    confidence: str
    human_outcome: Optional[str] = None


class InvoiceListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    case_id: Optional[str] = None
    original_filename: str
    file_hash: str
    status: str
    received_at: datetime
    submitted_by: Optional[str] = None
    job: Optional[JobSummary] = None
    run: Optional[RunSummary] = None


class InvoiceListResponse(BaseModel):
    """Invoice queue/history page (flat envelope, see schemas/common.PageOut)."""

    success: bool = True
    count: int = 0
    search: Optional[str] = None
    items: list[InvoiceListItem]
    total: int
    page: int = Field(1, ge=1)
    size: int = Field(25, ge=1, le=100)
    pages: int


class InvoiceDetail(InvoiceListItem):
    success: bool = True
    source_path: str
    extraction: Optional[dict] = None

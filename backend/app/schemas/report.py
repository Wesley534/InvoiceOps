# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Pydantic schemas for validation reports."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict


class ReportOut(BaseModel):
    """A validation report: identity metadata plus the full report payload.

    ``report`` is the contract-validated object (see
    ``contracts/validation_report.schema.json``); everything else is
    database metadata.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_id: str
    job_id: Optional[str] = None
    report_id: str
    decision: str
    confidence: str
    invoice_status: Optional[str] = None
    human_outcome: Optional[str] = None
    created_at: datetime
    report: Dict[str, Any]


class ExtractionPatchField(BaseModel):
    value: Optional[str] = None


class ExtractionPatchRequest(BaseModel):
    """Corrected invoice fields (gate G1). Only listed fields are replaced."""

    fields: Dict[str, ExtractionPatchField]


class ReportResponse(ReportOut):
    """Report resource as a single-object API response. The nested ``report``
    payload stays bare (it is the contract-validated report JSON)."""

    success: bool = True


class ExtractionPatchResponse(BaseModel):
    """Returns the re-validated report so the caller can update in place."""

    success: bool = True
    report: ReportOut
    revalidated: bool = True

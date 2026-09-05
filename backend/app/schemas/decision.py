# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Pydantic schemas for the human approval gate (approver role)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class DecideRequest(BaseModel):
    report_id: str = Field(description="The ValidationRun id (uuid).")
    outcome: Literal["approved", "rejected"]
    override_reason: Optional[str] = Field(
        default=None,
        description=(
            "Mandatory when overriding a BLOCK recommendation (an 'approved' "
            "outcome on a BLOCKed report)."
        ),
    )
    notes: Optional[str] = None


class DecisionOut(BaseModel):
    """The recorded human decision (root-level success flag)."""

    model_config = ConfigDict(from_attributes=True)

    success: bool = True
    id: str
    record_id: str
    report_id: str
    validation_run_id: str
    invoice_number: Optional[str] = None
    vendor: Optional[str] = None
    system_decision: str
    human_outcome: str
    decided_by: Optional[str] = None
    decided_at: Optional[datetime] = None
    override_reason: Optional[str] = None
    notes: Optional[str] = None

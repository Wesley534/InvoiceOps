# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Shared value enums for the InvoiceOps domain.

Columns are stored as plain strings (portable across SQLite and MySQL);
Python enums provide the single source of truth for allowed values, and
Pydantic schemas enforce them at the API boundary.
"""

from __future__ import annotations

import enum


class StrEnum(str, enum.Enum):
    """A string enum whose value is also its canonical serialized form."""

    def __str__(self) -> str:  # pragma: no cover - trivial
        return str(self.value)


class UserRole(StrEnum):
    REVIEWER = "reviewer"
    APPROVER = "approver"


class JobStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class JobStage(StrEnum):
    QUEUED = "queued"
    INTAKE = "intake"
    EXTRACTING = "extracting"
    VALIDATING = "validating"
    CLASSIFYING = "classifying"
    REPORTING = "reporting"
    DONE = "done"


class InvoiceStatus(StrEnum):
    RECEIVED = "RECEIVED"
    EXTRACTING = "EXTRACTING"
    AI_ANALYZED = "AI_ANALYZED"
    VALIDATING = "VALIDATING"
    CLASSIFIED = "CLASSIFIED"
    AWAITING_REVIEW = "AWAITING_REVIEW"
    BLOCKED = "BLOCKED"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"
    FAILED = "FAILED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    OVERRIDDEN = "OVERRIDDEN"
    COMPLETED = "COMPLETED"


class SystemDecision(StrEnum):
    PASS = "PASS"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"


class ConfidenceLevel(StrEnum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Severity(StrEnum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class CheckStatus(StrEnum):
    PASS = "pass"
    FAIL = "fail"
    NOT_APPLICABLE = "not_applicable"
    ERROR = "error"


class HumanOutcome(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    OVERRIDE_BLOCK = "override_block"


class ExtractionMethod(StrEnum):
    TEXT_LAYER_REGEX = "text_layer_regex"
    OCR = "ocr"
    LLM_VISION = "llm_vision"
    HYBRID = "hybrid"


class DecisionOutcome(StrEnum):
    """System decision used on the report payloads."""

    PASS = "PASS"
    REVIEW = "REVIEW"
    BLOCK = "BLOCK"

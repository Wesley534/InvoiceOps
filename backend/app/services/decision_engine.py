# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Decision Engine: table-driven PASS / REVIEW / BLOCK classification.

Rules, not probabilities:
  - any failed check of critical severity  -> BLOCK (hard stop)
  - any other failure, or unreliable extraction -> REVIEW
  - otherwise -> PASS

The model never decides; this is plain application logic over check results.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple


def classify(
    checks: List[Dict[str, Any]], *, extraction_reliable: bool
) -> Tuple[str, str, str]:
    """Return (decision, confidence, human_action_required)."""
    failed = [c for c in checks if c["status"] == "fail"]
    critical_failures = [c for c in failed if c["severity"] == "critical"]

    # Safety rule: an unreliable extraction never produces PASS or BLOCK. A
    # degraded/unreadable document always degrades to REVIEW so a human can
    # confirm or replace it - garbage must never drive a hard stop.
    if not extraction_reliable:
        decision = "REVIEW"
    elif critical_failures:
        decision = "BLOCK"
    elif failed:
        decision = "REVIEW"
    else:
        decision = "PASS"

    # Confidence is application-stamped, not a model score.
    if decision == "PASS":
        confidence = "high"
    elif decision == "BLOCK":
        confidence = "medium" if not extraction_reliable else "high"
    else:  # REVIEW
        confidence = "low" if not extraction_reliable else "medium"

    if decision == "BLOCK":
        human_action = "escalate"
    elif decision == "REVIEW":
        human_action = "confirm_extraction" if not extraction_reliable else "investigate"
    else:
        human_action = "approve"
    return decision, confidence, human_action


def is_extraction_reliable(extraction: Dict[str, Any]) -> bool:
    """Reliability gate: legible document with all essential figures present."""
    quality = extraction.get("document_quality", {}) or {}
    if not quality.get("legible", True):
        return False
    fields = extraction.get("fields", {})
    for key in ("invoice_number", "subtotal", "total_amount", "currency", "invoice_date"):
        value = (fields.get(key) or {}).get("value")
        if value in (None, ""):
            return False
    return True

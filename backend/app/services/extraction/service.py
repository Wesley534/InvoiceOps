# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Extraction Service: the extraction ladder.

  deterministic text-layer parse  ->  NVIDIA text repair  ->  NVIDIA vision

AI is only ever asked to repair or complete ambiguous fields. The application
stamps confidence/source deterministically and re-validates every value, so a
model outage or bad response degrades to the deterministic result (REVIEW when
the document needed AI help), never a silent PASS.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from app.models.enums import ExtractionMethod
from app.services.extraction.deterministic import (
    _found,
    case_id_from_filename,
    canonical_money,
    parse_document,
    to_decimal,
)
from app.services.llm.client import LLMError, get_client
from app.services.pdf_tools import PdfToolError, extract_text, ordered_pages, render_pages

logger = logging.getLogger(__name__)

# Values sourced from the LLM are stamped 'derived' (allowed by the contract)
# because the app derived them from the model's answer.
_LLM_SOURCE = "derived"

AI_FIELDS = {
    "invoice_number",
    "invoice_date",
    "vendor_name",
    "vendor_tax_pin",
    "po_number",
    "currency",
    "subtotal",
    "tax_rate",
    "tax_amount",
    "total_amount",
}


@dataclass
class ExtractionArtifacts:
    extraction: Dict[str, Any]
    raw_text: str
    ai_used: bool = False
    ai_call_id: Optional[str] = None
    degraded: bool = False
    notes: List[str] = field(default_factory=list)


class ExtractionError(RuntimeError):
    """Raised when extraction cannot proceed at all (tooling/config)."""


def is_degraded(extraction: Dict[str, Any]) -> bool:
    """True when the document could not be read reliably (no text / vision)."""
    quality = extraction.get("document_quality", {}) or {}
    return not quality.get("legible", True)


def _fill_from_llm(det: Dict[str, Any], llm: Dict[str, Any]) -> Dict[str, Any]:
    """Merge LLM-repaired values into the deterministic extraction.

    Deterministic values win when present (they come straight off the
    document); the LLM fills fields that are missing or unreadable. Fields the
    model left missing are recorded but not fabricated.
    """
    fields = det["fields"]
    issues = list(det.get("extraction_issues", []))
    repaired: List[str] = []

    for key, value in (llm.get("fields") or {}).items():
        if key not in AI_FIELDS:
            continue
        existing = fields.get(key)
        current_value = existing.get("value") if existing else None
        if current_value is not None and current_value != "":
            # Prefer deterministic values; only repair genuinely missing fields.
            continue
        if key in ("subtotal", "tax_amount", "total_amount"):
            value = canonical_money(str(value)) if value else None
        if value is None or str(value).strip() == "":
            continue
        fields[key] = _found(str(value).strip(), source=_LLM_SOURCE, confidence="medium")
        repaired.append(key)

    # LLM line items: only used when deterministic parsing found none.
    if not det.get("line_items") and llm.get("line_items"):
        items = []
        for idx, item in enumerate(llm["line_items"], start=1):
            if not isinstance(item, dict):
                continue
            quantity = str(item.get("quantity", "")).replace(",", "")
            unit = canonical_money(str(item.get("unit_price", "")))
            amount = canonical_money(str(item.get("amount", "")))
            if to_decimal(quantity) is None or unit is None or amount is None:
                continue
            items.append(
                {
                    "line_no": idx,
                    "description": str(item.get("description", "")).strip(),
                    "quantity": quantity,
                    "unit_price": unit,
                    "tax_rate": str(item.get("tax_rate", "0.00")),
                    "amount": amount,
                    "confidence": "medium",
                    "source": _LLM_SOURCE,
                }
            )
        if items:
            det["line_items"] = items
            det["extraction_method"] = ExtractionMethod.HYBRID.value
            repaired.append("line_items")

    if repaired:
        det["extraction_issues"] = issues
    if llm.get("notes"):
        for note in llm["notes"]:
            if isinstance(note, str) and note.strip():
                issues.append("LLM note: " + note.strip()[:300])
    det["extraction_issues"] = issues
    return det


def _run_ai_text_repair(det: Dict[str, Any], text: str) -> Tuple[Dict[str, Any], Optional[str]]:
    client = get_client()
    if not client.enabled:
        return det, None
    try:
        raw = client.repair_fields(text)
        call_id = "llm-text"
        return _fill_from_llm(det, client.normalize_output(raw)), call_id
    except LLMError as exc:
        logger.warning("LLM text repair unavailable, using deterministic extraction: %s", exc)
        det.setdefault("extraction_issues", []).append(
            "AI repair unavailable (%s); using deterministic extraction." % exc
        )
        return det, None


def _run_ai_vision(pdf_path: Path, det: Dict[str, Any]) -> Tuple[Dict[str, Any], bool, Optional[str]]:
    """Vision path for documents without a readable text layer."""
    client = get_client()
    if not client.enabled:
        det["extraction_issues"].append(
            "Document has no text layer and no vision model is configured "
            "(NVIDIA_API_KEY empty); extraction is unreliable."
        )
        return det, False, None
    try:
        pages = ordered_pages(render_pages(pdf_path))
        if not pages:
            raise ExtractionError("Vision path rendered no pages for %s" % pdf_path)
        raw = client.vision_extract(pages)
        merged, _ = _fill_from_llm(det, client.normalize_output(raw))
        merged["extraction_method"] = ExtractionMethod.LLM_VISION.value
        quality = dict(merged["document_quality"])
        quality["method"] = "llm_vision"
        quality["legible"] = bool(merged["line_items"]) and all(
            f.get("value") for f in merged["fields"].values() if f.get("value")
        )
        merged["document_quality"] = quality
        return merged, True, "llm-vision"
    except (LLMError, PdfToolError, ExtractionError) as exc:
        logger.warning("Vision extraction unavailable: %s", exc)
        det["extraction_issues"].append(
            "Vision extraction unavailable (%s); document is unreliable." % exc
        )
        return det, False, None


def extract_document(pdf_path: Path, *, source: str) -> ExtractionArtifacts:
    """Run the full extraction ladder for one PDF.

    Returns artifacts whose ``extraction`` dict matches the extraction
    contract. ``degraded`` marks documents the model could not rescue, which
    forces a REVIEW downstream.
    """
    if not pdf_path.exists():
        raise ExtractionError("PDF not found: %s" % pdf_path)

    filename = pdf_path.name
    case_id = case_id_from_filename(filename)

    try:
        text = extract_text(pdf_path)
    except PdfToolError as exc:
        raise ExtractionError(str(exc)) from exc

    det = parse_document(text, source=source, case_id=case_id)
    ai_used = False
    ai_call_id: Optional[str] = None

    if text.strip():
        # Text path: deterministic parse always runs; the repair step is
        # exercised when an API key is configured.
        det, ai_call_id = _run_ai_text_repair(det, text)
        ai_used = ai_call_id is not None
        degraded = not det["document_quality"]["legible"]
    else:
        # No text layer: only the vision path can help.
        det, ai_used, ai_call_id = _run_ai_vision(pdf_path, det)
        degraded = not det["document_quality"]["legible"]

    # Recompute legibility: a document is reliable only if the essential
    # figures were actually captured.
    fields = det["fields"]
    essential = ["invoice_number", "subtotal", "total_amount", "currency"]
    missing_essential = [key for key in essential if not fields.get(key, {}).get("value")]
    if missing_essential and det["document_quality"]["legible"]:
        det["document_quality"]["legible"] = False
        degraded = True

    notes = list(det["extraction_issues"])
    return ExtractionArtifacts(
        extraction=det,
        raw_text=text,
        ai_used=ai_used,
        ai_call_id=ai_call_id,
        degraded=degraded,
        notes=notes,
    )

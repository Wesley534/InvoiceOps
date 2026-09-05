# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Deterministic field extraction from a PDF text layer.

Pure regex/positional parsing - auditable, reproducible and unit-testable.
Output shape matches ``contracts/invoice_extraction.schema.json``. Fields the
parser cannot resolve are marked ``missing`` with low confidence; nothing is
guessed here (the LLM repair step may fill gaps afterwards).
"""

from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Tuple

from app.models.enums import ExtractionMethod

# ----------------------------------------------------------------------------
# Field canonicalization helpers
# ----------------------------------------------------------------------------

_MONEY_RE = re.compile(r"^\d+(?:\.\d{1,2})?$")


def canonical_money(raw: str) -> Optional[str]:
    """Normalize '32,000.00' / '32000' / '32000.00' to '32000.00'."""
    if raw is None:
        return None
    cleaned = raw.strip().replace(",", "").replace(" ", "")
    if not _MONEY_RE.match(cleaned):
        return None
    return "{:.2f}".format(Decimal(cleaned))


def to_decimal(raw: Optional[str]) -> Optional[Decimal]:
    if raw is None:
        return None
    cleaned = raw.strip().replace(",", "")
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def canonical_tax_rate(raw: str) -> str:
    """Normalize '16%' -> '0.16', 'Exempt' -> '0.00'."""
    cleaned = (raw or "").strip()
    percent = re.search(r"(\d+(?:\.\d+)?)\s*%", cleaned)
    if percent:
        return "{:.4f}".format(Decimal(percent.group(1)) / Decimal(100)).rstrip("0").rstrip(".")
    return "0.00"


# ----------------------------------------------------------------------------
# Field source / confidence stamping (application-controlled)
# ----------------------------------------------------------------------------
FIELD_KEYS = [
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
    "payment_notes",
]


def _empty_field() -> Dict[str, Optional[str]]:
    return {"value": None, "confidence": "missing", "source": "text_layer"}


def _found(value: Optional[str], source: str = "text_layer", confidence: str = "high") -> Dict[str, Optional[str]]:
    return {"value": value, "confidence": confidence, "source": source}


# ----------------------------------------------------------------------------
# Injection scan (deterministic content anomaly scan)
# ----------------------------------------------------------------------------
_INJECTION_PATTERNS: List[Tuple[str, re.Pattern]] = [
    ("instruction_override", re.compile(r"\bignore\s+(?:all\s+)?previous\s+instructions\b", re.IGNORECASE)),
    ("auto_approve_directive", re.compile(r"\bmark\s+this\s+invoice\s+as\s+(?:approved|paid)\b", re.IGNORECASE)),
    ("skip_validation_directive", re.compile(r"\b(?:do\s+not\s+verify|skip\s+(?:the\s+)?validation|bypass\s+checks)\b", re.IGNORECASE)),
    ("manual_review_bypass", re.compile(r"\bdo\s+not\s+flag\s+for\s+manual\s+review\b", re.IGNORECASE)),
    ("force_payment", re.compile(r"\bprocess\s+payment\s+immediately\b|\bapprove\s+and\s+pay\b", re.IGNORECASE)),
    ("override_duplicate_check", re.compile(r"\boverride\s+any\s+duplicate\s+detection\b|\bignore\s+duplicate\s+detection\b", re.IGNORECASE)),
    ("preauthorized_claim", re.compile(r"\bpre[- ]authorized\b", re.IGNORECASE)),
    ("ai_processor_label", re.compile(r"\bAI\s+PROCESSOR\b|\bFOR\s+AUTOMATED\s+PROCESSING\b", re.IGNORECASE)),
    ("system_role_claim", re.compile(r"\byou\s+are\s+(?:now\s+)?(?:an?\s+)?(?:AI|assistant|system)\b", re.IGNORECASE)),
]


def scan_prompt_injection(text: str) -> List[Dict[str, str]]:
    """Find embedded instructional content; invoice text is data, not code."""
    flags: List[Dict[str, str]] = []
    for name, pattern in _INJECTION_PATTERNS:
        for match in pattern.finditer(text or ""):
            start = text.rfind("\n", 0, match.start()) + 1
            end = text.find("\n", match.end())
            if end == -1:
                end = len(text)
            snippet = re.sub(r"\s+", " ", text[start:end]).strip()
            if snippet:
                flags.append({"pattern": name, "snippet": snippet[:200]})
    # Keep one flag per pattern, in document order of first hit.
    seen: set[str] = set()
    unique: List[Dict[str, str]] = []
    for flag in flags:
        if flag["pattern"] not in seen:
            seen.add(flag["pattern"])
            unique.append(flag)
    return unique


# ----------------------------------------------------------------------------
# Date parsing
# ----------------------------------------------------------------------------
_DATE_FORMATS = [
    "%B %d, %Y", "%b %d, %Y", "%B %d %Y", "%b %d %Y",
    "%d %B %Y", "%d %b %Y", "%Y-%m-%d", "%d/%m/%Y",
    "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d",
]


def parse_date(value: str) -> Optional[str]:
    """Return ISO ``YYYY-MM-DD`` for common human date formats, else None."""
    cleaned = (value or "").strip().rstrip(".")
    if not cleaned:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(cleaned, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


# ----------------------------------------------------------------------------
# Layout parsing
# ----------------------------------------------------------------------------
def _grab_field(text: str, label_pattern: re.Pattern) -> Optional[str]:
    """Find a label anywhere in the document; return the value to end-of-line.

    Labels can sit mid-line (after a long contact line, e.g.
    '...Email: ap@pacifictrading.com     Invoice No: MT-2026-0847'), so the
    label is not required to start the line. The first occurrence wins.
    """
    match = label_pattern.search(text)
    if not match:
        return None
    end_of_line = text.find("\n", match.end())
    segment = text[match.end():end_of_line] if end_of_line != -1 else text[match.end():]
    value = segment.strip()
    return value if value else None


_LABELS = {
    "invoice_no": re.compile(r"Invoice\s*No\.?[ \t]*[:#]?[ \t]*"),
    "invoice_date": re.compile(r"Invoice\s*Date[ \t]*[:#]?[ \t]*"),
    "po_number": re.compile(r"PO\s*(?:Number|No\.?)[ \t]*[:#]?[ \t]*"),
    "currency": re.compile(r"Currency[ \t]*[:#]?[ \t]*"),
}


def _first_ref(text: str) -> Optional[str]:
    """Find the reference-looking token (e.g. 'PO-1001' or 'MPS-2026-0041')."""
    for token in re.findall(r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+", text or ""):
        return token
    return None


_ITEM_ROW_RE = re.compile(
    r"^\s*(?P<no>\d{1,3})\s+(?P<desc>.+?)\s{2,}"
    r"(?P<qty>[\d,]+(?:\.\d+)?)\s+"
    r"(?P<price>[\d,]+\.\d{2})\s+"
    r"(?P<tax>(?:\d+(?:\.\d+)?%|Exempt))\s+"
    r"(?P<amt>[\d,]+\.\d{2})\s*$"
)


def _parse_line_items(text: str) -> List[Dict[str, object]]:
    """Parse the tabular line-items block between the header and Subtotal."""
    items: List[Dict[str, object]] = []
    header_index = -1
    subtotal_index = -1
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if header_index == -1 and "#" in line and "Description" in line and "Amount" in line:
            header_index = i
        elif header_index != -1 and re.search(r"\bSubtotal\s*:", line):
            subtotal_index = i
            break

    if header_index == -1:
        return items
    region = lines[header_index + 1: subtotal_index if subtotal_index != -1 else None]
    for line in region:
        match = _ITEM_ROW_RE.match(line)
        if not match:
            continue
        group = match.groupdict()
        qty_raw = group["qty"].replace(",", "")
        price_raw = group["price"].replace(",", "")
        amount_raw = group["amt"].replace(",", "")
        qty = to_decimal(qty_raw)
        price = to_decimal(price_raw)
        amount = to_decimal(amount_raw)
        if qty is None or price is None or amount is None:
            continue
        tax = canonical_tax_rate(group["tax"])
        items.append(
            {
                "line_no": int(group["no"]),
                "description": group["desc"].strip(),
                "quantity": "{:g}".format(qty).replace(".0", ""),
                "unit_price": canonical_money("{:.2f}".format(price)),
                "tax_rate": tax,
                "amount": "{:.2f}".format(amount),
                "confidence": "high",
                "source": "text_layer",
            }
        )
    return items


def _parse_totals(text: str) -> Dict[str, Optional[str]]:
    """Locate subtotal / tax / total blocks (last occurrence wins)."""
    results: Dict[str, Optional[str]] = {"subtotal": None, "tax_amount": None, "tax_rate": None}

    matches = list(re.finditer(r"Subtotal\s*:?\s*(?:[A-Za-z]{3}\s*)?(?P<amt>[\d,]+\.\d{2})", text))
    if matches:
        results["subtotal"] = matches[-1].group("amt")

    tax_matches = list(
        re.finditer(
            r"\b(?:VAT|Import Duty|Sales Tax|Withholding Tax|Tax|Duty)\s*\((?P<rate>[^)]*)\)"
            r"\s*:?\s*(?:[A-Za-z]{3}\s*)?(?P<amt>[\d,]+\.\d{2})",
            text,
        )
    )
    if tax_matches:
        last = tax_matches[-1]
        results["tax_amount"] = last.group("amt")
        rate = last.group("rate")
        percent = re.search(r"(\d+(?:\.\d+)?)\s*%", rate)
        if percent:
            results["tax_rate"] = canonical_tax_rate(rate)
        else:
            results["tax_rate"] = "0.00"

    total_matches = list(re.finditer(r"TOTAL\s*:?\s*(?:[A-Za-z]{3}\s*)?(?P<amt>[\d,]+\.\d{2})", text))
    if total_matches:
        results["total_amount"] = total_matches[-1].group("amt")
    return results


def _extract_payment_notes(text: str, max_chars: int = 2000) -> Optional[str]:
    marker = re.search(r"PAYMENT\s+(?:DETAILS|INSTRUCTIONS)\s*:?\s*", text, re.IGNORECASE)
    if not marker:
        return None
    tail = text[marker.end():]
    for stop in ("This invoice is computer-generated", "BILL TO / PURCHASER"):
        idx = tail.find(stop)
        if idx != -1:
            tail = tail[:idx]
    cleaned = re.sub(r"[ \t]+", " ", tail).strip()
    return cleaned[:max_chars] if cleaned else None


def _strip_line(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


# ----------------------------------------------------------------------------
# Main entry point
# ----------------------------------------------------------------------------
def parse_document(text: str, *, source: str, case_id: Optional[str] = None) -> Dict[str, object]:
    """Build a contract-shaped extraction payload from a PDF text layer."""
    issues: List[str] = []
    fields: Dict[str, Dict[str, Optional[str]]] = {key: _empty_field() for key in FIELD_KEYS}
    lines = text.splitlines()

    # Vendor block: name sits directly above the 'Tax PIN: ...' line.
    vendor_name: Optional[str] = None
    vendor_pin: Optional[str] = None
    for i, line in enumerate(lines):
        if "Tax PIN" in line:
            if i > 0:
                candidate = _strip_line(lines[i - 1])
                if candidate and "Invoice" not in candidate and "No:" not in candidate:
                    vendor_name = candidate
            pin_match = re.search(r"Tax\s+PIN\s*:\s*([^\s|]+)", line)
            if pin_match:
                vendor_pin = pin_match.group(1).strip()
            break

    # Right-column metadata block (present on every generated invoice).
    invoice_no_value = _grab_field(text, _LABELS["invoice_no"])
    invoice_date_value = _grab_field(text, _LABELS["invoice_date"])
    po_value = _grab_field(text, _LABELS["po_number"])
    currency_value = _grab_field(text, _LABELS["currency"])

    if vendor_name:
        fields["vendor_name"] = _found(vendor_name[:255])
    else:
        issues.append("Vendor name could not be read from the document header.")

    if vendor_pin:
        fields["vendor_tax_pin"] = _found(vendor_pin.upper())
    else:
        issues.append("Vendor tax PIN not found on the document.")

    if invoice_no_value:
        fields["invoice_number"] = _found(invoice_no_value[:64])
    else:
        issues.append("Invoice number not found on the document.")

    if invoice_date_value:
        iso_date = parse_date(invoice_date_value)
        if iso_date:
            fields["invoice_date"] = _found(iso_date)
        else:
            fields["invoice_date"] = {"value": None, "confidence": "low", "source": "text_layer"}
            issues.append("Invoice date could not be parsed: %r" % invoice_date_value)
    else:
        issues.append("Invoice date field is absent from the document.")

    if po_value:
        po_ref = _first_ref(po_value)
        if po_ref:
            fields["po_number"] = _found(po_ref.upper())
        else:
            issues.append("PO reference on the document could not be interpreted: %r" % po_value)
    else:
        fields["po_number"] = _empty_field()

    if currency_value:
        match = re.match(r"([A-Za-z]{3})", currency_value.strip())
        code = match.group(1).upper() if match else None
        if code:
            fields["currency"] = _found(code)
        else:
            issues.append("Currency value not recognised: %r" % currency_value)
    else:
        issues.append("Currency field is absent from the document.")

    totals = _parse_totals(text)
    for key, canon in (
        ("subtotal", canonical_money),
        ("tax_amount", canonical_money),
        ("total_amount", canonical_money),
    ):
        raw = totals.get(key)
        value = canon(raw) if raw else None
        if value:
            fields[key] = _found(value)
        elif key == "tax_amount" and totals.get("tax_amount") is None:
            fields[key] = {"value": "0.00", "confidence": "medium", "source": "derived"}
        else:
            issues.append("%s could not be read from the totals block." % key.replace("_", " "))

    if totals.get("tax_rate"):
        fields["tax_rate"] = _found(totals["tax_rate"])

    payment_notes = _extract_payment_notes(text)
    if payment_notes:
        fields["payment_notes"] = _found(payment_notes, confidence="medium")

    line_items = _parse_line_items(text)
    if not line_items and text.strip():
        issues.append("No line items could be parsed from the line-items table.")

    injection_flags = scan_prompt_injection(text)

    document_legible = bool(text.strip()) and bool(line_items) and totals.get("subtotal") is not None
    if not text.strip():
        issues.append(
            "No extractable text layer was found; the PDF appears to be a scanned "
            "image that requires OCR or a vision model."
        )

    extraction = {
        "schema_version": "1.0",
        "case_id": (case_id or "UNKNOWN").upper(),
        "source": source,
        "extraction_method": ExtractionMethod.TEXT_LAYER_REGEX.value,
        "extracted_at": datetime.utcnow().isoformat() + "Z",
        "fields": fields,
        "line_items": line_items,
        "document_quality": {
            "legible": document_legible,
            "method": "text_layer" if text.strip() else "unknown",
            "notes": [],
        },
        "extraction_issues": issues,
        "prompt_injection_flags": injection_flags,
    }
    return extraction


def case_id_from_filename(filename: str) -> Optional[str]:
    match = re.search(r"(CASE-\d{3})", filename, re.IGNORECASE)
    return match.group(1).upper() if match else None

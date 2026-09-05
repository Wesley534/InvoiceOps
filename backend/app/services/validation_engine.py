# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Validation Engine: the 11 deterministic checks.

Pure, unit-testable functions with Decimal math and policy tolerances. No LLM
is involved: thresholds come from Meridian's invoice-processing policy and are
identical run-to-run. Every check returns a result dict matching the contract
``check`` shape so the evidence package is reproducible.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from app.services.master_data import MasterData, PurchaseOrder, Vendor

CHECK_IDS = [
    "vendor_approved",
    "po_exists_open",
    "po_vendor_match",
    "po_currency_match",
    "po_quantity_match",
    "po_amount_match",
    "arithmetic_correct",
    "goods_received",
    "duplicate_not_found",
    "fields_complete",
    "content_clean",
]

CHECK_NAMES = {
    "vendor_approved": "Vendor is approved",
    "po_exists_open": "Purchase order exists and is open",
    "po_vendor_match": "PO vendor matches the invoice vendor",
    "po_currency_match": "PO currency matches the invoice currency",
    "po_quantity_match": "Invoiced quantities are within PO quantities",
    "po_amount_match": "Invoice total is within PO balance",
    "arithmetic_correct": "Line items, tax and total arithmetic is correct",
    "goods_received": "Goods/services receipt is confirmed",
    "duplicate_not_found": "No duplicate in processed-invoice history",
    "fields_complete": "All required fields are present",
    "content_clean": "No anomalous (prompt-injection) content",
}

CHECK_SEVERITY = {
    "vendor_approved": "critical",
    "po_exists_open": "high",
    "po_vendor_match": "high",
    "po_currency_match": "high",
    "po_quantity_match": "medium",
    "po_amount_match": "medium",
    "arithmetic_correct": "high",
    "goods_received": "high",
    "duplicate_not_found": "critical",
    "fields_complete": "medium",
    "content_clean": "critical",
}

_TOLERANCE_PCT = Decimal("1.0")  # amount variance allowed before a mismatch flag

Pass = "pass"
Fail = "fail"
NotApplicable = "not_applicable"


def _check(check_id: str, status: str, detail: str, evidence: Optional[List[str]] = None) -> Dict[str, Any]:
    return {
        "check_id": check_id,
        "name": CHECK_NAMES[check_id],
        "status": status,
        "severity": CHECK_SEVERITY[check_id],
        "detail": detail,
        "evidence": evidence or [],
    }


def _fmt(value: Decimal) -> str:
    return "{:,.2f}".format(value)


def _field_value(extraction: Dict[str, Any], key: str) -> Optional[str]:
    field = extraction.get("fields", {}).get(key) or {}
    value = field.get("value")
    if value in (None, ""):
        return None
    return str(value)


def _dec(extraction: Dict[str, Any], key: str) -> Optional[Decimal]:
    value = _field_value(extraction, key)
    if value is None:
        return None
    try:
        return Decimal(str(value).replace(",", ""))
    except Exception:
        return None


def _sum_qty(items: List[Dict[str, Any]]) -> Decimal:
    total = Decimal("0")
    for item in items:
        qty = item.get("quantity")
        if qty is None:
            continue
        try:
            total += Decimal(str(qty).replace(",", ""))
        except Exception:
            continue
    return total


def _po_total_qty(po: PurchaseOrder) -> Decimal:
    return sum((line.quantity for line in po.lines), Decimal("0"))


def _evidence_vendor(vendor: Optional[Vendor]) -> List[str]:
    if vendor is None:
        return []
    return ["vendor_master -> %s" % vendor.vendor_id]


def _evidence_po(po: Optional[PurchaseOrder]) -> List[str]:
    if po is None:
        return []
    return ["purchase_orders -> %s" % po.number]


def _pct_over(base: Decimal, actual: Decimal) -> Decimal:
    if base == 0:
        return Decimal("0")
    return (actual - base) / base * Decimal("100")


# ---------------------------------------------------------------------------
def run_checks(
    extraction: Dict[str, Any], master: MasterData
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Run all 11 checks. Returns (checks, issues) with an issue per failure."""
    line_items = extraction.get("line_items", [])
    doc_quality = extraction.get("document_quality", {}) or {}

    vendor_name = _field_value(extraction, "vendor_name")
    vendor_pin = _field_value(extraction, "vendor_tax_pin")
    po_number = _field_value(extraction, "po_number")
    currency = _field_value(extraction, "currency")

    vendor = master.resolve_vendor(tax_pin=vendor_pin, name=vendor_name) if (vendor_pin or vendor_name) else None
    po = master.get_po(po_number)
    # A referenced PO that does not exist must stay visible as a failure even
    # if the number is non-blank.
    po_referenced = po_number is not None

    invoice_total = _dec(extraction, "total_amount")

    results: List[Dict[str, Any]] = []

    # 1 ------------------------------------------------------------------
    if vendor is None:
        status, detail = Fail, (
            "No approved vendor record matches the invoice (name=%r, tax_pin=%r)."
            % (vendor_name or "", vendor_pin or "")
        )
    elif not vendor.approved:
        status, detail = Fail, (
            "Vendor %s (%s) is NOT APPROVED in the vendor master." % (vendor.vendor_id, vendor.display_name)
        )
    else:
        status, detail = Pass, (
            "Vendor %s (%s) exists and is Approved." % (vendor.vendor_id, vendor.display_name)
        )
    results.append(_check("vendor_approved", status, detail, _evidence_vendor(vendor)))

    # 2 ------------------------------------------------------------------
    if po is None:
        if po_referenced:
            detail = "PO %r is not in the purchase-order register." % po_number
        else:
            detail = "The invoice does not reference a purchase order."
        results.append(_check("po_exists_open", Fail, detail, []))
    elif po.status.lower() != "open":
        results.append(
            _check(
                "po_exists_open", Fail,
                "PO %s exists but its status is %r (not Open)." % (po.number, po.status),
                _evidence_po(po),
            )
        )
    else:
        results.append(
            _check(
                "po_exists_open", Pass,
                "PO %s exists and is Open." % po.number,
                _evidence_po(po),
            )
        )

    # 3-6 require a resolved PO -------------------------------------------------
    po_found = po is not None

    # 3 vendor match
    if not po_found or vendor is None:
        if not po_found:
            status, detail = NotApplicable, "No PO to compare against."
        else:
            status, detail = NotApplicable, "Vendor could not be resolved."
        results.append(_check("po_vendor_match", status, detail, _evidence_po(po)))
    elif po.vendor_id != vendor.vendor_id:
        results.append(
            _check(
                "po_vendor_match", Fail,
                "PO %s belongs to %s but the invoice vendor is %s (%s)."
                % (po.number, po.vendor_id, vendor.vendor_id, vendor.display_name),
                _evidence_po(po) + _evidence_vendor(vendor),
            )
        )
    else:
        results.append(
            _check(
                "po_vendor_match", Pass,
                "PO %s and the invoice both belong to %s (%s)."
                % (po.number, vendor.vendor_id, vendor.display_name),
                _evidence_po(po) + _evidence_vendor(vendor),
            )
        )

    # 4 currency
    if not po_found:
        results.append(_check("po_currency_match", NotApplicable, "No PO to compare against.", []))
    elif currency is None:
        results.append(_check("po_currency_match", NotApplicable, "Invoice currency is missing.", []))
    elif currency.upper() != po.currency.upper():
        results.append(
            _check(
                "po_currency_match", Fail,
                "Invoice is in %s but PO %s is denominated in %s."
                % (currency, po.number, po.currency),
                _evidence_po(po),
            )
        )
    else:
        results.append(
            _check(
                "po_currency_match", Pass,
                "Invoice and PO %s are both in %s." % (po.number, currency),
                _evidence_po(po),
            )
        )

    # 5 quantity
    if not po_found:
        results.append(_check("po_quantity_match", NotApplicable, "No PO to compare against.", []))
    else:
        invoiced_qty = _sum_qty(line_items)
        ordered_qty = _po_total_qty(po)
        if invoiced_qty > ordered_qty:
            overage = _pct_over(ordered_qty, invoiced_qty)
            results.append(
                _check(
                    "po_quantity_match", Fail,
                    "Invoice quantity %s exceeds the PO quantity %s for %s (+%s%% overage)."
                    % (_fmt(invoiced_qty), _fmt(ordered_qty), po.number, _fmt(overage)),
                    _evidence_po(po),
                )
            )
        else:
            results.append(
                _check(
                    "po_quantity_match", Pass,
                    "Invoice quantity %s is within PO %s quantity %s."
                    % (_fmt(invoiced_qty), po.number, _fmt(ordered_qty)),
                    _evidence_po(po),
                )
            )

    # 6 amount
    if not po_found or invoice_total is None:
        if not po_found:
            results.append(_check("po_amount_match", NotApplicable, "No PO to compare against.", []))
        else:
            results.append(_check("po_amount_match", NotApplicable, "Invoice total is missing.", []))
    else:
        variance = _pct_over(po.total, invoice_total)
        if invoice_total > po.total and variance > _TOLERANCE_PCT:
            results.append(
                _check(
                    "po_amount_match", Fail,
                    "Invoice total %s exceeds PO %s total %s by %s%%."
                    % (_fmt(invoice_total), po.number, _fmt(po.total), _fmt(variance)),
                    _evidence_po(po),
                )
            )
        else:
            direction = "equals" if invoice_total == po.total else "is within"
            results.append(
                _check(
                    "po_amount_match", Pass,
                    "Invoice total %s %s PO %s total %s."
                    % (_fmt(invoice_total), direction, po.number, _fmt(po.total)),
                    _evidence_po(po),
                )
            )

    # 7 arithmetic -------------------------------------------------------------
    arithmetic_issues: List[str] = []
    if not line_items:
        arithmetic_issues.append("No line items available to verify.")
    for item in line_items:
        try:
            qty = Decimal(str(item.get("quantity", "")).replace(",", ""))
            unit = Decimal(str(item.get("unit_price", "")).replace(",", ""))
            stated = Decimal(str(item.get("amount", "")).replace(",", ""))
        except Exception:
            continue
        expected = (qty * unit).quantize(Decimal("0.01"))
        if expected != stated:
            arithmetic_issues.append(
                "Line %s: %s x %s = %s but the invoice states %s."
                % (item.get("line_no"), _fmt(qty), _fmt(unit), _fmt(expected), _fmt(stated))
            )

    subtotal = _dec(extraction, "subtotal")
    tax_rate = _dec(extraction, "tax_rate")
    tax_amount = _dec(extraction, "tax_amount")
    total = invoice_total

    if subtotal is not None and line_items:
        line_sum = sum((Decimal(str(i["amount"]).replace(",", "")) for i in line_items), Decimal("0"))
        line_sum = line_sum.quantize(Decimal("0.01"))
        if line_sum != subtotal:
            arithmetic_issues.append(
                "Line-item sum %s does not match the stated subtotal %s."
                % (_fmt(line_sum), _fmt(subtotal))
            )
    if subtotal is not None and tax_rate is not None and tax_amount is not None and tax_rate != 0:
        expected_tax = (subtotal * tax_rate).quantize(Decimal("0.01"))
        if expected_tax != tax_amount:
            arithmetic_issues.append(
                "Tax at %s of subtotal %s is %s but the invoice states %s."
                % (tax_rate, _fmt(subtotal), _fmt(expected_tax), _fmt(tax_amount))
            )
    if subtotal is not None and tax_amount is not None and total is not None:
        expected_total = (subtotal + tax_amount).quantize(Decimal("0.01"))
        if expected_total != total:
            arithmetic_issues.append(
                "Subtotal %s + tax %s = %s but the stated total is %s."
                % (_fmt(subtotal), _fmt(tax_amount), _fmt(expected_total), _fmt(total))
            )

    if arithmetic_issues:
        results.append(_check("arithmetic_correct", Fail, " ".join(arithmetic_issues), []))
    else:
        results.append(
            _check(
                "arithmetic_correct", Pass,
                "All line items, subtotal, tax and total reconcile.",
                [],
            )
        )

    # 8 goods received ---------------------------------------------------------
    if not po_found:
        results.append(_check("goods_received", NotApplicable, "No PO to check receipts against.", []))
    else:
        receipts = master.receipts_for(po.number)
        if not receipts:
            results.append(
                _check(
                    "goods_received", Fail,
                    "No goods-receipt record exists for PO %s." % po.number,
                    _evidence_po(po),
                )
            )
        else:
            received = sum((r.quantity_received for r in receipts), Decimal("0"))
            invoiced_qty = _sum_qty(line_items)
            if received < invoiced_qty:
                results.append(
                    _check(
                        "goods_received", Fail,
                        "Goods receipt for PO %s totals %s but the invoice claims %s."
                        % (po.number, _fmt(received), _fmt(invoiced_qty)),
                        ["goods_receipts -> " + r.grn_number for r in receipts][:6],
                    )
                )
            else:
                results.append(
                    _check(
                        "goods_received", Pass,
                        "Goods/services for PO %s confirmed received (%s)."
                        % (po.number, _fmt(received)),
                        ["goods_receipts -> " + r.grn_number for r in receipts][:6],
                    )
                )

    # 9 duplicate --------------------------------------------------------------
    duplicate = master.find_duplicate(
        invoice_number=_field_value(extraction, "invoice_number"),
        vendor_id=vendor.vendor_id if vendor else None,
        total_amount=total,
    )
    if duplicate:
        results.append(
            _check(
                "duplicate_not_found", Fail,
                "Invoice %s for %s totalling %s matches processed record %s (approved %s)."
                % (
                    duplicate.invoice_number,
                    duplicate.vendor_id,
                    _fmt(duplicate.total_amount),
                    duplicate.internal_id,
                    duplicate.status,
                ),
                ["processed_invoices -> %s" % duplicate.internal_id],
            )
        )
    else:
        results.append(
            _check(
                "duplicate_not_found", Pass,
                "No matching invoice number + vendor + amount in processed history.",
                [],
            )
        )

    # 10 required fields --------------------------------------------------------
    missing = [
        key.replace("_", " ")
        for key in ("invoice_number", "invoice_date", "vendor_name", "currency",
                    "subtotal", "tax_amount", "total_amount")
        if _field_value(extraction, key) is None
    ]
    if not line_items:
        missing.append("line items")
    if not doc_quality.get("legible", True):
        missing.append("readable document")
    if missing:
        results.append(
            _check(
                "fields_complete", Fail,
                "Required field(s) missing or unreadable: %s." % ", ".join(sorted(missing)),
                [],
            )
        )
    else:
        results.append(_check("fields_complete", Pass, "All required fields are present.", []))

    # 11 content anomalies -------------------------------------------------------
    flags = extraction.get("prompt_injection_flags", [])
    if flags:
        patterns = ", ".join(f["pattern"] for f in flags)
        results.append(
            _check(
                "content_clean", Fail,
                "Embedded instructional/anomalous content detected (%s). Invoice content is treated as data, never instructions."
                % patterns,
                ["text anomaly: " + f["pattern"] for f in flags],
            )
        )
    else:
        results.append(
            _check("content_clean", Pass, "No anomalous instructional content detected.", [])
        )

    # ------------------------------------------------------------------ issues
    issues: List[Dict[str, Any]] = []
    for result in results:
        if result["status"] != Fail:
            continue
        tier = "block" if result["severity"] == "critical" else "review"
        issues.append(
            {
                "check_id": result["check_id"],
                "tier": tier,
                "description": result["detail"],
                "evidence": result["evidence"],
            }
        )
    return results, issues

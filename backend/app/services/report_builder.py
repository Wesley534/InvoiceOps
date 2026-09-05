# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Report Generator: assembles the evidence package and human-readable report.

Every claim in the report cites a check and a master-data record. Text is
templated - no LLM prose in evidence - and the final object is validated
against ``contracts/validation_report.schema.json``.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from app.services.master_data import MasterData, PurchaseOrder, Vendor

_EVIDENCE_VENDOR_KEYS = [
    "Vendor ID", "Legal Name", "Trading Name", "Tax PIN", "Approved Status",
    "Default Currency", "Vendor Category",
]


def _vendor_dict(vendor: Optional[Vendor]) -> Optional[Dict[str, str]]:
    if vendor is None:
        return None
    return {key: vendor.raw.get(key, "") for key in _EVIDENCE_VENDOR_KEYS}


def _po_dict(po: Optional[PurchaseOrder]) -> Optional[Dict[str, Any]]:
    if po is None:
        return None
    return {
        "po_number": po.number,
        "vendor_id": po.vendor_id,
        "po_date": po.po_date,
        "currency": po.currency,
        "description": po.description,
        "status": po.status,
        "delivery_status": po.delivery_status,
        "subtotal": str(po.subtotal),
        "tax": str(po.tax),
        "total": str(po.total),
        "line_items": [
            {
                "description": line.description,
                "quantity": str(line.quantity),
                "unit_price": str(line.unit_price),
                "tax_treatment": line.tax_treatment,
                "amount": str(line.line_subtotal),
            }
            for line in po.lines
        ],
    }


def _money(raw: str) -> str:
    try:
        return "{:,.2f}".format(Decimal(raw.replace(",", "")))
    except Exception:
        return raw


def build_evidence_package(
    extraction: Dict[str, Any], master: MasterData
) -> Dict[str, Any]:
    fields = extraction.get("fields", {})
    vendor_name = (fields.get("vendor_name") or {}).get("value")
    vendor_pin = (fields.get("vendor_tax_pin") or {}).get("value")
    po_number = (fields.get("po_number") or {}).get("value")
    total_raw = (fields.get("total_amount") or {}).get("value")

    vendor = master.resolve_vendor(tax_pin=vendor_pin, name=vendor_name)
    po = master.get_po(po_number)
    receipts = master.receipts_for(po.number) if po else []
    history: List[Dict[str, Any]] = []
    if po is not None and vendor is not None and total_raw:
        duplicate = master.find_duplicate(
            invoice_number=(fields.get("invoice_number") or {}).get("value"),
            vendor_id=vendor.vendor_id,
            total_amount=Decimal(total_raw.replace(",", "")),
        )
        if duplicate is not None:
            history.append(
                {
                    "internal_id": duplicate.internal_id,
                    "invoice_number": duplicate.invoice_number,
                    "vendor_id": duplicate.vendor_id,
                    "po_number": duplicate.po_number,
                    "currency": duplicate.currency,
                    "total_amount": _money(str(duplicate.total_amount)),
                    "status": duplicate.status,
                    "processed_date": duplicate.processed_date,
                }
            )

    return {
        "vendor": _vendor_dict(vendor),
        "po": _po_dict(po),
        "receipts": [
            {
                "grn_number": receipt.grn_number,
                "po_number": receipt.po_number,
                "description": receipt.description,
                "quantity_ordered": str(receipt.quantity_ordered),
                "quantity_received": str(receipt.quantity_received),
                "receipt_date": receipt.receipt_date,
                "status": receipt.status,
            }
            for receipt in receipts
        ],
        "history": history,
    }


_ACTION_TEXTS = {
    "approve": "Route to the approver for final approval.",
    "investigate": "Investigate the issues below against the evidence package before deciding.",
    "confirm_extraction": "Confirm or correct the extracted fields (gate G1) before relying on the checks.",
    "escalate": "Hard stop: escalate immediately per policy. Override requires a written reason from an approver.",
}


def build_recommendation(
    decision: str, human_action: str, issues: List[Dict[str, Any]]
) -> Dict[str, str]:
    tier = decision.lower()
    if decision == "BLOCK":
        points = [
            "- %s: %s" % (i["check_id"], i["description"][:240]) for i in issues[:6]
        ]
        text = "Block this invoice. " + " ".join(points) if points else "Block this invoice."
    elif decision == "REVIEW":
        points = [
            "- %s: %s" % (i["check_id"], i["description"][:240]) for i in issues[:6]
        ]
        text = (
            "Send this invoice for review; it did not pass every check. "
            + (" ".join(points) if points else "")
        ).strip()
    else:
        text = "All validation checks passed; this invoice is ready for human approval."
    text = (text + " " + _ACTION_TEXTS.get(human_action, "")).strip()
    return {"text": text, "tier": tier}


def build_report(
    *,
    report_id: str,
    case_id: str,
    source: str,
    extraction: Dict[str, Any],
    checks: List[Dict[str, Any]],
    issues: List[Dict[str, Any]],
    decision: str,
    confidence: str,
    human_action_required: str,
    processing_time_seconds: float,
    master: MasterData,
    schema_version: str = "1.0",
) -> Dict[str, Any]:
    report = {
        "schema_version": schema_version,
        "report_id": report_id,
        "case_id": case_id,
        "source": source,
        "decision": decision,
        "confidence": confidence,
        "processing_time_seconds": round(float(processing_time_seconds), 3),
        "extraction": extraction,
        "checks": checks,
        "issues": issues,
        "recommendation": build_recommendation(decision, human_action_required, issues),
        "human_action_required": human_action_required,
        "evidence_package": build_evidence_package(extraction, master),
    }
    return report


def build_report_markdown(report: Dict[str, Any]) -> str:
    """Render the stored report as a plain-text Markdown document."""
    checks = report.get("checks", [])
    extraction = report.get("extraction", {})
    fields = extraction.get("fields", {})
    lines: List[str] = []
    lines.append("# InvoiceOps validation report")
    lines.append("")
    lines.append("- report_id: %s" % report.get("report_id"))
    lines.append("- case_id: %s" % report.get("case_id", "UNKNOWN"))
    lines.append("- source: %s" % report.get("source", ""))
    lines.append("- decision: **%s**" % report.get("decision"))
    lines.append("- confidence: %s" % report.get("confidence"))
    lines.append("- processing_time_seconds: %s" % report.get("processing_time_seconds"))
    lines.append("- human_action_required: %s" % report.get("human_action_required"))
    lines.append("")

    lines.append("## Extracted fields")
    lines.append("")
    lines.append("| Field | Value | Confidence | Source |")
    lines.append("| --- | --- | --- | --- |")
    for key in sorted(fields):
        field = fields[key]
        value = (field or {}).get("value")
        lines.append(
            "| %s | %s | %s | %s |"
            % (key, value if value is not None else "(missing)", field.get("confidence"), field.get("source"))
        )
    lines.append("")

    items = extraction.get("line_items", [])
    lines.append("## Line items (%d)" % len(items))
    lines.append("")
    lines.append("| # | Description | Qty | Unit price | Tax | Amount |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    for item in items:
        lines.append(
            "| %s | %s | %s | %s | %s | %s |"
            % (
                item.get("line_no"),
                item.get("description"),
                item.get("quantity"),
                item.get("unit_price"),
                item.get("tax_rate"),
                item.get("amount"),
            )
        )
    lines.append("")

    lines.append("## Validation checks (%d/11)" % len(checks))
    lines.append("")
    for check in checks:
        icon = {"pass": "[PASS]", "fail": "[FAIL]", "not_applicable": "[N/A]", "error": "[ERROR]"}.get(
            check.get("status", ""), "[?]"
        )
        lines.append("- %s %s (%s): %s" % (icon, check.get("name"), check.get("check_id"), check.get("detail")))
        for ref in check.get("evidence", []):
            lines.append("  - evidence: %s" % ref)
    lines.append("")

    issues = report.get("issues", [])
    lines.append("## Issues (%d)" % len(issues))
    lines.append("")
    for issue in issues:
        lines.append("- [%s] %s" % (issue.get("tier"), issue.get("description")))
    if not issues:
        lines.append("- none")
    lines.append("")

    recommendation = report.get("recommendation", {})
    lines.append("## Recommendation (%s)" % recommendation.get("tier"))
    lines.append("")
    lines.append(recommendation.get("text", ""))
    lines.append("")

    package = report.get("evidence_package", {})
    lines.append("## Evidence package")
    lines.append("")
    vendor = package.get("vendor")
    lines.append("vendor: %s" % (vendor.get("Vendor ID") + " " + vendor.get("Legal Name") if vendor else "no match"))
    po = package.get("po")
    if po:
        lines.append("po: %s (%s, total %s %s)" % (po.get("po_number"), po.get("status"), po.get("currency"), po.get("total")))
    else:
        lines.append("po: no match")
    lines.append("receipts: %d record(s)" % len(package.get("receipts", [])))
    lines.append("history: %d record(s)" % len(package.get("history", [])))
    lines.append("")
    return "\n".join(lines)

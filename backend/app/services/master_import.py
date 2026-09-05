# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Seed the master-data tables from the evaluation CSVs (optional).

Import is idempotent: rows are matched by their natural business key
(vendor code, PO number, GRN number + PO + description, internal id) and
upserted. PO line items are replaced wholesale per PO. Records that exist in
the database but not in the CSVs are left untouched (the API is the source
of truth once data is in the database).
"""

from __future__ import annotations

import csv
import logging
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.master import (
    MasterGoodsReceipt,
    MasterPoLine,
    MasterProcessedInvoice,
    MasterPurchaseOrder,
    MasterVendor,
)
from app.services.master_data import MasterDataError

logger = logging.getLogger(__name__)


@dataclass
class ImportSummary:
    vendors_created: int = 0
    vendors_updated: int = 0
    pos_created: int = 0
    pos_updated: int = 0
    lines_created: int = 0
    receipts_created: int = 0
    receipts_updated: int = 0
    processed_created: int = 0
    processed_updated: int = 0


def _parse_date(raw: str) -> date | None:
    value = (raw or "").strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _money(raw: str, *, field: str, where: str) -> Decimal:
    value = (raw or "").strip().replace(",", "").replace(" ", "")
    if value in ("", "-"):
        value = "0"
    try:
        return Decimal(value)
    except InvalidOperation as exc:
        raise MasterDataError("Invalid amount %r for %s on %s" % (raw, field, where)) from exc


def _percent_rate(text: str) -> Decimal:
    """Rate from 'VAT (16.0%)' / 'Import Duty (10.0%)'; default 0."""
    match = re.search(r"([\d.]+)\s*%", text or "")
    if not match:
        return Decimal("0")
    return Decimal(match.group(1)) / Decimal("100")


def _rows(path: Path) -> list[dict]:
    if not path.exists():
        raise MasterDataError("Missing master data file: %s" % path)
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise MasterDataError("Empty master data file: %s" % path)
        return [
            {k.strip(): (v or "").strip() for k, v in row.items()}
            for row in reader
            if any((v or "").strip() for v in row.values())
        ]


def _upsert_vendor(db: Session, row: dict) -> tuple[MasterVendor, bool]:
    vendor_id = row["Vendor ID"].strip().upper()
    instance = db.scalar(select(MasterVendor).where(MasterVendor.vendor_id == vendor_id))
    created = instance is None
    if instance is None:
        instance = MasterVendor(vendor_id=vendor_id)
        db.add(instance)
    instance.legal_name = row["Legal Name"]
    instance.trading_name = row.get("Trading Name") or None
    instance.tax_pin = row.get("Tax PIN") or None
    instance.vat_number = row.get("VAT Number") or None
    instance.address = row.get("Address") or None
    instance.contact_email = row.get("Contact Email") or None
    instance.contact_phone = row.get("Contact Phone") or None
    instance.approved = (row.get("Approved Status") or "").strip().lower() == "approved"
    instance.default_currency = row.get("Default Currency") or None
    instance.bank_account_identifier = row.get("Bank Account Identifier") or None
    instance.vendor_category = row.get("Vendor Category") or None
    return instance, created


def _upsert_po(db: Session, row: dict) -> tuple[MasterPurchaseOrder, bool]:
    po_number = row["PO Number"].strip().upper()
    instance = db.scalar(
        select(MasterPurchaseOrder)
        .where(MasterPurchaseOrder.po_number == po_number)
        .options(selectinload(MasterPurchaseOrder.lines))
    )
    created = instance is None
    if instance is None:
        instance = MasterPurchaseOrder(po_number=po_number)
        db.add(instance)
    instance.vendor_id = row["Vendor ID"].strip().upper()
    instance.po_date = _parse_date(row.get("PO Date", ""))
    instance.currency = row.get("Currency") or None
    instance.description = row.get("Description") or None
    instance.status = row.get("PO Status") or "Open"
    instance.delivery_status = row.get("Delivery/Receipt Status") or None
    instance.subtotal = _money(row.get("PO Subtotal", "0"), field="PO Subtotal", where=po_number)
    instance.tax = _money(row.get("PO Tax", "0"), field="PO Tax", where=po_number)
    instance.total = _money(row.get("PO Total", "0"), field="PO Total", where=po_number)
    return instance, created


def load_from_directory(db: Session, directory: Path) -> ImportSummary:
    """Upsert all four CSV registers into the database."""
    directory = Path(directory)
    if not directory.exists():
        raise MasterDataError(
            "Master data directory not found: %s. Set MASTER_DATA_DIR or point "
            "the importer at the directory containing the four CSVs." % directory
        )
    summary = ImportSummary()

    for raw in _rows(directory / "vendor_master.csv"):
        _, created = _upsert_vendor(db, raw)
        if created:
            summary.vendors_created += 1
        else:
            summary.vendors_updated += 1

    # Purchase orders: each CSV row is a PO header plus one line item;
    # continuation rows with an empty PO Number belong to the current PO.
    current_po: MasterPurchaseOrder | None = None
    for raw in _rows(directory / "purchase_orders.csv"):
        if raw.get("PO Number"):
            current_po, created = _upsert_po(db, raw)
            if created:
                summary.pos_created += 1
            else:
                summary.pos_updated += 1
                # Replacing lines keeps re-imports in sync with the CSV.
                for old in list(current_po.lines):
                    db.delete(old)
                db.flush()
        if current_po is None:
            raise MasterDataError(
                "PO line row appears before any PO header in purchase_orders.csv"
            )
        description = raw.get("Line Item Description", "")
        if not description:
            continue
        line = MasterPoLine(
            po_id=current_po.id,
            sort_order=len(current_po.lines) + 1,
            description=description,
            quantity=_money(raw.get("Quantity", "0"), field="Quantity", where=current_po.po_number),
            unit_price=_money(raw.get("Unit Price", "0"), field="Unit Price", where=current_po.po_number),
            tax_treatment=raw.get("Tax Treatment") or None,
            tax_rate=_percent_rate(raw.get("Tax Treatment", "")),
            line_subtotal=_money(raw.get("Line Subtotal", "0"), field="Line Subtotal", where=current_po.po_number),
        )
        current_po.lines.append(line)
        summary.lines_created += 1

    for raw in _rows(directory / "goods_receipts.csv"):
        grn_number = raw["GRN Number"]
        po_number = raw["PO Number"].strip().upper()
        description = raw.get("Item/Service Description", "")
        instance = db.scalar(
            select(MasterGoodsReceipt).where(
                MasterGoodsReceipt.grn_number == grn_number,
                MasterGoodsReceipt.po_number == po_number,
                MasterGoodsReceipt.description == description,
            )
        )
        created = instance is None
        if instance is None:
            instance = MasterGoodsReceipt(
                grn_number=grn_number, po_number=po_number, description=description
            )
            db.add(instance)
        instance.quantity_ordered = _money(
            raw.get("Quantity Ordered", "0"), field="Quantity Ordered", where=grn_number
        )
        instance.quantity_received = _money(
            raw.get("Quantity Received", "0"), field="Quantity Received", where=grn_number
        )
        instance.receipt_date = _parse_date(raw.get("Receipt Date", ""))
        instance.status = raw.get("Receiving Status") or None
        if created:
            summary.receipts_created += 1
        else:
            summary.receipts_updated += 1

    for raw in _rows(directory / "processed_invoices.csv"):
        internal_id = raw["Internal ID"]
        instance = db.scalar(
            select(MasterProcessedInvoice).where(MasterProcessedInvoice.internal_id == internal_id)
        )
        created = instance is None
        if instance is None:
            instance = MasterProcessedInvoice(internal_id=internal_id)
            db.add(instance)
        instance.invoice_number = raw["Invoice Number"]
        instance.vendor_id = raw["Vendor ID"].strip().upper()
        instance.invoice_date = _parse_date(raw.get("Invoice Date", ""))
        instance.po_number = raw.get("PO Number") or None
        instance.currency = raw.get("Currency") or None
        instance.total_amount = _money(raw.get("Total Amount", "0"), field="Total Amount", where=internal_id)
        instance.processing_status = raw.get("Processing Status") or None
        instance.processing_date = _parse_date(raw.get("Processing Date", ""))
        if created:
            summary.processed_created += 1
        else:
            summary.processed_updated += 1

    db.commit()
    logger.info("Master data import complete: %s", summary)
    return summary

# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Master Data Service: database-backed registers used by the pipeline.

Master data (vendors, purchase orders, goods receipts, processed invoices)
lives in the database and is editable through the API. The evaluation CSVs
can seed it via ``python -m app.import_master_data`` (see
``app.services.master_import``).

This module exposes the domain types and a repository with the same lookups
the validation engine needs: resolve a vendor, load a PO with its lines, list
receipts for a PO, and find a duplicate in the processed-invoice register.
All money is Decimal.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal
from difflib import SequenceMatcher
from typing import List, Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.master import (
    MasterGoodsReceipt,
    MasterProcessedInvoice,
    MasterPurchaseOrder,
    MasterVendor,
)


class MasterDataError(RuntimeError):
    """Raised when master data is unavailable or inconsistent."""


# ------------------------------------------------------------------- records
@dataclass
class Vendor:
    vendor_id: str
    legal_name: str
    trading_name: str
    tax_pin: str
    approved: bool
    default_currency: str
    category: str
    raw: dict = field(default_factory=dict)

    @property
    def display_name(self) -> str:
        return self.legal_name


@dataclass
class PoLine:
    description: str
    quantity: Decimal
    unit_price: Decimal
    tax_treatment: str
    tax_rate: Decimal
    line_subtotal: Decimal


@dataclass
class PurchaseOrder:
    number: str
    vendor_id: str
    po_date: str
    currency: str
    description: str
    status: str
    delivery_status: str
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    lines: List[PoLine] = field(default_factory=list)


@dataclass
class GoodsReceipt:
    grn_number: str
    po_number: str
    description: str
    quantity_ordered: Decimal
    quantity_received: Decimal
    receipt_date: str
    status: str


@dataclass
class ProcessedInvoice:
    internal_id: str
    invoice_number: str
    vendor_id: str
    invoice_date: str
    po_number: str
    currency: str
    total_amount: Decimal
    status: str
    processed_date: str


# -------------------------------------------------------------- text helpers
_STOPWORDS = {
    "ltd", "limited", "inc", "incorporated", "company", "co", "corporation",
    "corp", "llc", "gmbh", "plc", "sa", "the", "and", "of", "group", "holdings",
    "international", "enterprises", "solutions",
}


def _name_tokens(name: str) -> List[str]:
    tokens = [t for t in re.split(r"[^a-z0-9]+", (name or "").lower()) if t]
    return [t for t in tokens if t not in _STOPWORDS]


def _token_overlap(a: Sequence[str], b: Sequence[str]) -> float:
    """Fraction of the shorter token list that matches the longer one."""
    if not a or not b:
        return 0.0
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    matched = 0
    for token in shorter:
        if any(
            token == other
            or (len(token) >= 4 and other.startswith(token))
            or SequenceMatcher(None, token, other).ratio() >= 0.82
            for other in longer
        ):
            matched += 1
    return matched / len(shorter)


def _normalize_ref(value: str) -> str:
    return "".join(ch for ch in (value or "").upper() if ch.isalnum())


def _money(value: Decimal | None) -> str:
    if value is None:
        return ""
    return str(value)


def _to_vendor_domain(row: MasterVendor) -> Vendor:
    approved_status = "Approved" if row.approved else "NOT APPROVED"
    return Vendor(
        vendor_id=row.vendor_id,
        legal_name=row.legal_name,
        trading_name=row.trading_name or row.legal_name,
        tax_pin=(row.tax_pin or "").strip().upper(),
        approved=row.approved,
        default_currency=row.default_currency or "",
        category=row.vendor_category or "",
        raw={
            "Vendor ID": row.vendor_id,
            "Legal Name": row.legal_name,
            "Trading Name": row.trading_name or "",
            "Tax PIN": row.tax_pin or "",
            "VAT Number": row.vat_number or "",
            "Approved Status": approved_status,
            "Default Currency": row.default_currency or "",
            "Vendor Category": row.vendor_category or "",
        },
    )


def _to_po_domain(row: MasterPurchaseOrder) -> PurchaseOrder:
    return PurchaseOrder(
        number=row.po_number,
        vendor_id=row.vendor_id,
        po_date=row.po_date.isoformat() if row.po_date else "",
        currency=row.currency or "",
        description=row.description or "",
        status=row.status or "",
        delivery_status=row.delivery_status or "",
        subtotal=row.subtotal,
        tax=row.tax,
        total=row.total,
        lines=[
            PoLine(
                description=line.description,
                quantity=line.quantity,
                unit_price=line.unit_price,
                tax_treatment=line.tax_treatment or "",
                tax_rate=line.tax_rate,
                line_subtotal=line.line_subtotal,
            )
            for line in row.lines
        ],
    )


def _to_grn_domain(row: MasterGoodsReceipt) -> GoodsReceipt:
    return GoodsReceipt(
        grn_number=row.grn_number,
        po_number=row.po_number,
        description=row.description,
        quantity_ordered=row.quantity_ordered,
        quantity_received=row.quantity_received,
        receipt_date=row.receipt_date.isoformat() if row.receipt_date else "",
        status=row.status or "",
    )


def _to_processed_domain(row: MasterProcessedInvoice) -> ProcessedInvoice:
    return ProcessedInvoice(
        internal_id=row.internal_id,
        invoice_number=row.invoice_number,
        vendor_id=row.vendor_id,
        invoice_date=row.invoice_date.isoformat() if row.invoice_date else "",
        po_number=row.po_number or "",
        currency=row.currency or "",
        total_amount=row.total_amount,
        status=row.processing_status or "",
        processed_date=row.processing_date.isoformat() if row.processing_date else "",
    )


# ----------------------------------------------------------------- repository
class MasterData:
    """Read lookups over the master-data tables for one database session."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # -------------------------------------------------------------- status --
    def counts(self) -> dict:
        return {
            "vendors": self.db.scalar(select(func.count()).select_from(MasterVendor)) or 0,
            "purchase_orders": self.db.scalar(select(func.count()).select_from(MasterPurchaseOrder)) or 0,
            "goods_receipts": self.db.scalar(select(func.count()).select_from(MasterGoodsReceipt)) or 0,
            "processed_invoices": self.db.scalar(select(func.count()).select_from(MasterProcessedInvoice)) or 0,
        }

    def ready(self) -> bool:
        """All four registers should be populated before validation runs."""
        counts = self.counts()
        return all(counts[key] > 0 for key in ("vendors", "purchase_orders", "goods_receipts"))

    def require_ready(self) -> None:
        if not self.ready():
            counts = self.counts()
            empty = [key for key, value in counts.items() if value == 0]
            raise MasterDataError(
                "Master data is incomplete in the database (empty registers: %s). "
                "Seed it with `python -m app.import_master_data` or add records "
                "through the master-data API." % ", ".join(empty)
            )

    # ------------------------------------------------------------- lookups --
    def resolve_vendor(
        self, *, tax_pin: Optional[str] = None, name: Optional[str] = None
    ) -> Optional[Vendor]:
        """Resolve a vendor by tax PIN (authoritative) then fuzzy name match."""
        rows = self.db.scalars(select(MasterVendor)).all()
        if not rows:
            return None

        pin = (tax_pin or "").strip().upper()
        if pin:
            for row in rows:
                if (row.tax_pin or "").strip().upper() == pin:
                    return _to_vendor_domain(row)

        if not name:
            return None
        wanted_tokens = _name_tokens(name)
        if not wanted_tokens:
            return None
        best_row: Optional[MasterVendor] = None
        best_score = 0.0
        for row in rows:
            candidates = _name_tokens(row.legal_name) + _name_tokens(row.trading_name or "")
            score = _token_overlap(wanted_tokens, candidates)
            if score > best_score:
                best_score = score
                best_row = row
        if best_row is not None and best_score >= 0.8:
            return _to_vendor_domain(best_row)
        return None

    def get_po(self, po_number: Optional[str]) -> Optional[PurchaseOrder]:
        if not po_number:
            return None
        number = po_number.strip().upper()
        row = self.db.scalar(
            select(MasterPurchaseOrder)
            .where(MasterPurchaseOrder.po_number == number)
            .options(selectinload(MasterPurchaseOrder.lines))
        )
        return _to_po_domain(row) if row is not None else None

    def receipts_for(self, po_number: Optional[str]) -> List[GoodsReceipt]:
        if not po_number:
            return []
        rows = self.db.scalars(
            select(MasterGoodsReceipt).where(
                MasterGoodsReceipt.po_number == po_number.strip().upper()
            )
        ).all()
        return [_to_grn_domain(row) for row in rows]

    def find_duplicate(
        self,
        *,
        invoice_number: Optional[str],
        vendor_id: Optional[str],
        total_amount: Optional[Decimal],
    ) -> Optional[ProcessedInvoice]:
        """Match a processed-history record by number + vendor + amount."""
        if not invoice_number or total_amount is None:
            return None
        wanted = _normalize_ref(invoice_number)
        rows = self.db.scalars(select(MasterProcessedInvoice)).all()
        for row in rows:
            if _normalize_ref(row.invoice_number) != wanted:
                continue
            if vendor_id and row.vendor_id != vendor_id:
                continue
            if row.total_amount == total_amount:
                return _to_processed_domain(row)
        return None

    # --------------------------------------------------------- convenience --
    def vendor_by_id(self, vendor_id: str) -> Optional[MasterVendor]:
        return self.db.scalar(
            select(MasterVendor).where(MasterVendor.vendor_id == vendor_id.strip().upper())
        )

    def po_by_number(self, po_number: str) -> Optional[MasterPurchaseOrder]:
        return self.db.scalar(
            select(MasterPurchaseOrder)
            .where(MasterPurchaseOrder.po_number == po_number.strip().upper())
            .options(selectinload(MasterPurchaseOrder.lines))
        )

    def vendor_exists(self, vendor_id: str) -> bool:
        return self.vendor_by_id(vendor_id) is not None

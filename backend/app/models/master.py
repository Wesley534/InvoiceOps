# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Master data models: vendors, purchase orders (+ line items), goods
receipts and processed invoices.

Master data now lives in the database (editable through the API) and is
optionally seeded from the evaluation CSVs (``MASTER_DATA_DIR``). Natural
business keys (vendor code, PO number, internal id) stay unique so CSV
imports and user edits are idempotent.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UuidPkMixin


class MasterVendor(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "master_vendors"

    vendor_id: Mapped[str] = mapped_column(
        String(16), unique=True, index=True, nullable=False
    )
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    trading_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tax_pin: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    vat_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    default_currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    bank_account_identifier: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    vendor_category: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    purchase_orders: Mapped[List["MasterPurchaseOrder"]] = relationship(
        back_populates="vendor", passive_deletes=True
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return "<MasterVendor %s %r>" % (self.vendor_id, self.legal_name)


class MasterPurchaseOrder(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "master_purchase_orders"

    po_number: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )
    vendor_id: Mapped[str] = mapped_column(
        String(16),
        ForeignKey("master_vendors.vendor_id", ondelete="RESTRICT"),
        index=True,
        nullable=False,
    )
    po_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="Open")
    delivery_status: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=Decimal("0"))

    vendor: Mapped["MasterVendor"] = relationship(back_populates="purchase_orders")
    lines: Mapped[List["MasterPoLine"]] = relationship(
        back_populates="po",
        cascade="all, delete-orphan",
        order_by="MasterPoLine.sort_order",
        passive_deletes=True,
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return "<MasterPurchaseOrder %s>" % self.po_number


class MasterPoLine(UuidPkMixin, Base):
    __tablename__ = "master_po_lines"

    po_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("master_purchase_orders.id", ondelete="CASCADE"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    tax_treatment: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(8, 6), nullable=False, default=Decimal("0"))
    line_subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)

    po: Mapped["MasterPurchaseOrder"] = relationship(back_populates="lines")


class MasterGoodsReceipt(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "master_goods_receipts"

    grn_number: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    po_number: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity_ordered: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    quantity_received: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    receipt_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return "<MasterGoodsReceipt %s %s>" % (self.grn_number, self.po_number)


class MasterProcessedInvoice(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "master_processed_invoices"

    internal_id: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, nullable=False
    )
    invoice_number: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    vendor_id: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    invoice_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    po_number: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    processing_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    processing_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return "<MasterProcessedInvoice %s %s>" % (self.internal_id, self.invoice_number)

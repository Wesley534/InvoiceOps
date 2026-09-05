# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Pydantic schemas for the editable master-data registers."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

_ID_RE = r"^[A-Za-z0-9][A-Za-z0-9._/-]*$"
_CURRENCY_RE = r"^[A-Za-z]{3}$"


def _upper(value: str) -> str:
    return value.strip().upper()


# ------------------------------------------------------------------- vendors
class VendorBase(BaseModel):
    vendor_id: str = Field(pattern=_ID_RE, max_length=16)
    legal_name: str = Field(min_length=1, max_length=255)
    trading_name: Optional[str] = Field(default=None, max_length=255)
    tax_pin: Optional[str] = Field(default=None, max_length=64)
    vat_number: Optional[str] = Field(default=None, max_length=64)
    address: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(default=None, max_length=64)
    approved: bool = True
    default_currency: Optional[str] = Field(default=None, pattern=_CURRENCY_RE)
    bank_account_identifier: Optional[str] = Field(default=None, max_length=128)
    vendor_category: Optional[str] = Field(default=None, max_length=120)

    @field_validator("vendor_id", "default_currency", mode="before")
    @classmethod
    def _upper_normalize(cls, value):
        return _upper(value) if isinstance(value, str) else value


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    legal_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    trading_name: Optional[str] = Field(default=None, max_length=255)
    tax_pin: Optional[str] = Field(default=None, max_length=64)
    vat_number: Optional[str] = Field(default=None, max_length=64)
    address: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(default=None, max_length=64)
    approved: Optional[bool] = None
    default_currency: Optional[str] = Field(default=None, pattern=_CURRENCY_RE)
    bank_account_identifier: Optional[str] = Field(default=None, max_length=128)
    vendor_category: Optional[str] = Field(default=None, max_length=120)


class VendorOut(VendorBase):
    model_config = ConfigDict(from_attributes=True)

    created_at: object
    updated_at: object


# ------------------------------------------------------------- purchase orders
class PoLineIn(BaseModel):
    description: str = Field(min_length=1)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(ge=0)
    tax_treatment: Optional[str] = Field(default=None, max_length=120)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    line_subtotal: Optional[Decimal] = Field(default=None, ge=0)


class PoLineOut(BaseModel):
    id: str
    sort_order: int
    description: str
    quantity: Decimal
    unit_price: Decimal
    tax_treatment: Optional[str] = None
    tax_rate: Decimal
    line_subtotal: Decimal


class PurchaseOrderBase(BaseModel):
    po_number: str = Field(pattern=_ID_RE, max_length=32)
    vendor_id: str = Field(pattern=_ID_RE, max_length=16)
    po_date: Optional[date] = None
    currency: Optional[str] = Field(default=None, pattern=_CURRENCY_RE)
    description: Optional[str] = None
    status: str = Field(default="Open", max_length=32)
    delivery_status: Optional[str] = Field(default=None, max_length=64)
    subtotal: Optional[Decimal] = Field(default=None, ge=0)
    tax: Optional[Decimal] = Field(default=None, ge=0)
    total: Optional[Decimal] = Field(default=None, ge=0)

    @field_validator("po_number", "vendor_id", "currency", mode="before")
    @classmethod
    def _upper_normalize(cls, value):
        return _upper(value) if isinstance(value, str) else value


class PurchaseOrderCreate(PurchaseOrderBase):
    lines: List[PoLineIn] = Field(min_length=1)


class PurchaseOrderUpdate(BaseModel):
    po_date: Optional[date] = None
    currency: Optional[str] = Field(default=None, pattern=_CURRENCY_RE)
    description: Optional[str] = None
    status: Optional[str] = Field(default=None, max_length=32)
    delivery_status: Optional[str] = Field(default=None, max_length=64)
    subtotal: Optional[Decimal] = Field(default=None, ge=0)
    tax: Optional[Decimal] = Field(default=None, ge=0)
    total: Optional[Decimal] = Field(default=None, ge=0)
    lines: Optional[List[PoLineIn]] = None


class PurchaseOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    po_number: str
    vendor_id: str
    po_date: Optional[date] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    status: str
    delivery_status: Optional[str] = None
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    lines: List[PoLineOut]


# ------------------------------------------------------------ goods receipts
class GoodsReceiptCreate(BaseModel):
    grn_number: str = Field(pattern=_ID_RE, max_length=32)
    po_number: str = Field(pattern=_ID_RE, max_length=32)
    description: str = Field(min_length=1)
    quantity_ordered: Decimal = Field(ge=0)
    quantity_received: Decimal = Field(ge=0)
    receipt_date: Optional[date] = None
    status: Optional[str] = Field(default=None, max_length=32)

    @field_validator("grn_number", "po_number", mode="before")
    @classmethod
    def _upper_normalize(cls, value):
        return _upper(value) if isinstance(value, str) else value


class GoodsReceiptUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1)
    quantity_ordered: Optional[Decimal] = Field(default=None, ge=0)
    quantity_received: Optional[Decimal] = Field(default=None, ge=0)
    receipt_date: Optional[date] = None
    status: Optional[str] = Field(default=None, max_length=32)


class GoodsReceiptOut(GoodsReceiptCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: object
    updated_at: object


# -------------------------------------------------------- processed invoices
class ProcessedInvoiceCreate(BaseModel):
    internal_id: str = Field(pattern=_ID_RE, max_length=32)
    invoice_number: str = Field(min_length=1, max_length=64)
    vendor_id: str = Field(pattern=_ID_RE, max_length=16)
    invoice_date: Optional[date] = None
    po_number: Optional[str] = Field(default=None, pattern=_ID_RE, max_length=32)
    currency: Optional[str] = Field(default=None, pattern=_CURRENCY_RE)
    total_amount: Decimal = Field(ge=0)
    processing_status: Optional[str] = Field(default=None, max_length=32)
    processing_date: Optional[date] = None

    @field_validator("internal_id", "invoice_number", "vendor_id", "po_number", "currency", mode="before")
    @classmethod
    def _upper_normalize(cls, value):
        return _upper(value) if isinstance(value, str) else value


class ProcessedInvoiceUpdate(BaseModel):
    invoice_number: Optional[str] = Field(default=None, min_length=1, max_length=64)
    invoice_date: Optional[date] = None
    po_number: Optional[str] = Field(default=None, pattern=_ID_RE, max_length=32)
    currency: Optional[str] = Field(default=None, pattern=_CURRENCY_RE)
    total_amount: Optional[Decimal] = Field(default=None, ge=0)
    processing_status: Optional[str] = Field(default=None, max_length=32)
    processing_date: Optional[date] = None


class ProcessedInvoiceOut(ProcessedInvoiceCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: object
    updated_at: object


# ----------------------------------------------------------------- envelopes
# The register schemas above double as list-row types (they stay bare inside
# ``PageOut.items``). Single-object endpoints (create / read / update) respond
# with the wrapper below, which adds the root-level ``success`` flag.

class VendorResponse(VendorOut):
    success: bool = True


class PurchaseOrderResponse(PurchaseOrderOut):
    success: bool = True


class GoodsReceiptResponse(GoodsReceiptOut):
    success: bool = True


class ProcessedInvoiceResponse(ProcessedInvoiceOut):
    success: bool = True

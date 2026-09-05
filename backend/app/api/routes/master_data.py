# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Master-data management endpoints.

Users (reviewer and approver roles) can add and maintain vendors, purchase
orders, goods receipts and processed invoices. Registers are validated
against existing records (e.g. a PO must reference a known vendor) and writes
are audited. Reads of this register data support the upload queue screens.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.api.deps import require_reviewer
from app.db.session import get_db
from app.models.master import (
    MasterGoodsReceipt,
    MasterPoLine,
    MasterProcessedInvoice,
    MasterPurchaseOrder,
    MasterVendor,
)
from app.models.user import User
from app.schemas.master import (
    GoodsReceiptCreate,
    GoodsReceiptOut,
    GoodsReceiptResponse,
    GoodsReceiptUpdate,
    PoLineIn,
    PoLineOut,
    ProcessedInvoiceCreate,
    ProcessedInvoiceOut,
    ProcessedInvoiceResponse,
    ProcessedInvoiceUpdate,
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PurchaseOrderResponse,
    PurchaseOrderUpdate,
    VendorCreate,
    VendorOut,
    VendorResponse,
    VendorUpdate,
)
from app.schemas.common import PageOut
from app.services.audit import write_audit

router = APIRouter(prefix="/master-data", tags=["master-data"])


def _conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=409, detail=detail)


def _not_found(what: str) -> HTTPException:
    return HTTPException(status_code=404, detail=what + " not found")


def _po_totals(lines: list, subtotal: Optional[Decimal], tax: Optional[Decimal]) -> tuple[Decimal, Decimal, Decimal]:
    """Compute PO totals from lines unless explicit values were supplied."""
    computed_subtotal = sum((line.line_subtotal or (line.quantity * line.unit_price)) for line in lines)
    computed_subtotal = Decimal(computed_subtotal).quantize(Decimal("0.01"))
    computed_tax = sum((line.line_subtotal or (line.quantity * line.unit_price)) * line.tax_rate for line in lines)
    computed_tax = Decimal(computed_tax).quantize(Decimal("0.01"))
    total_subtotal = subtotal if subtotal is not None else computed_subtotal
    total_tax = tax if tax is not None else computed_tax
    total_total = total_subtotal + total_tax
    return total_subtotal, total_tax, total_total


def _po_lines_to_out(lines) -> list[PoLineOut]:
    return [
        PoLineOut(
            id=line.id,
            sort_order=line.sort_order,
            description=line.description,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_treatment=line.tax_treatment,
            tax_rate=line.tax_rate,
            line_subtotal=line.line_subtotal,
        )
        for line in lines
    ]


def _po_out(po: MasterPurchaseOrder) -> PurchaseOrderOut:
    return PurchaseOrderOut(
        id=po.id,
        po_number=po.po_number,
        vendor_id=po.vendor_id,
        po_date=po.po_date,
        currency=po.currency,
        description=po.description,
        status=po.status,
        delivery_status=po.delivery_status,
        subtotal=po.subtotal,
        tax=po.tax,
        total=po.total,
        lines=_po_lines_to_out(po.lines),
    )


def _po_lines_instances(po: MasterPurchaseOrder, lines: list[PoLineIn]) -> list[MasterPoLine]:
    return [
        MasterPoLine(
            sort_order=index,
            description=line.description,
            quantity=line.quantity,
            unit_price=line.unit_price,
            tax_treatment=line.tax_treatment,
            tax_rate=line.tax_rate,
            line_subtotal=line.line_subtotal
            if line.line_subtotal is not None
            else (line.quantity * line.unit_price).quantize(Decimal("0.01")),
        )
        for index, line in enumerate(lines, start=1)
    ]


# ============================================================================
# Vendors
# ============================================================================
@router.post("/vendors", response_model=VendorResponse, status_code=201)
def create_vendor(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> MasterVendor:
    """Create a vendor and return the stored record (no refetch needed)."""
    if db.scalar(select(MasterVendor).where(MasterVendor.vendor_id == payload.vendor_id)):
        raise _conflict("A vendor with code %s already exists." % payload.vendor_id)
    data = payload.model_dump()
    vendor = MasterVendor(**data)
    db.add(vendor)
    db.flush()
    write_audit(
        db, action="master.vendor.created", actor=current_user,
        detail={"vendor_id": vendor.vendor_id, "name": vendor.legal_name},
    )
    db.commit()
    db.refresh(vendor)
    return vendor


@router.get("/vendors", response_model=PageOut[VendorOut])
def list_vendors(
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
    q: Optional[str] = Query(default=None, description="Substring filter on code or name"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
) -> PageOut[VendorOut]:
    conditions = []
    search = q.strip() if q else None
    if search:
        pattern = "%" + search + "%"
        conditions.append(
            or_(
                MasterVendor.vendor_id.ilike(pattern),
                MasterVendor.legal_name.ilike(pattern),
                MasterVendor.trading_name.ilike(pattern),
            )
        )
    total = db.scalar(select(func.count()).select_from(MasterVendor).where(*conditions)) or 0
    rows = db.scalars(
        select(MasterVendor)
        .where(*conditions)
        .order_by(MasterVendor.vendor_id)
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    items = [VendorOut.model_validate(v) for v in rows]
    return PageOut[VendorOut](
        items=items, total=total, page=page, size=size,
        pages=(total + size - 1) // size, count=len(items), search=search,
    )


@router.get("/vendors/{vendor_id}", response_model=VendorResponse)
def get_vendor(
    vendor_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> MasterVendor:
    vendor = db.scalar(select(MasterVendor).where(MasterVendor.vendor_id == vendor_id.upper()))
    if vendor is None:
        raise _not_found("Vendor %s" % vendor_id)
    return vendor


@router.patch("/vendors/{vendor_id}", response_model=VendorResponse)
def update_vendor(
    vendor_id: str,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> MasterVendor:
    """Update a vendor and return the stored record (no refetch needed)."""
    vendor = db.scalar(select(MasterVendor).where(MasterVendor.vendor_id == vendor_id.upper()))
    if vendor is None:
        raise _not_found("Vendor %s" % vendor_id)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(vendor, key, value)
    write_audit(
        db, action="master.vendor.updated", actor=current_user,
        detail={"vendor_id": vendor.vendor_id, "fields": sorted(changes)},
    )
    db.commit()
    db.refresh(vendor)
    return vendor


@router.delete("/vendors/{vendor_id}")
def delete_vendor(
    vendor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> dict:
    vendor = db.scalar(select(MasterVendor).where(MasterVendor.vendor_id == vendor_id.upper()))
    if vendor is None:
        raise _not_found("Vendor %s" % vendor_id)
    try:
        db.delete(vendor)
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise _conflict(
            "Vendor %s still has purchase orders; delete or reassign them first." % vendor.vendor_id
        ) from exc
    write_audit(
        db, action="master.vendor.deleted", actor=current_user,
        detail={"vendor_id": vendor.vendor_id, "name": vendor.legal_name},
    )
    db.commit()
    return {"success": True, "detail": "Vendor %s deleted." % vendor.vendor_id}


# ============================================================================
# Purchase orders
# ============================================================================
@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=201)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> PurchaseOrderOut:
    if db.scalar(select(MasterPurchaseOrder).where(MasterPurchaseOrder.po_number == payload.po_number)):
        raise _conflict("A purchase order %s already exists." % payload.po_number)
    if not db.scalar(select(MasterVendor).where(MasterVendor.vendor_id == payload.vendor_id)):
        raise HTTPException(
            status_code=422,
            detail="Unknown vendor_id %r; create the vendor first." % payload.vendor_id,
        )

    subtotal, tax, total = _po_totals(payload.lines, payload.subtotal, payload.tax)
    po = MasterPurchaseOrder(
        po_number=payload.po_number,
        vendor_id=payload.vendor_id,
        po_date=payload.po_date,
        currency=payload.currency,
        description=payload.description,
        status=payload.status,
        delivery_status=payload.delivery_status,
        subtotal=subtotal,
        tax=tax,
        total=total,
    )
    db.add(po)
    db.flush()
    po.lines.extend(_po_lines_instances(po, payload.lines))
    db.flush()
    write_audit(
        db, action="master.po.created", actor=current_user,
        detail={"po_number": po.po_number, "vendor_id": po.vendor_id, "lines": len(po.lines)},
    )
    db.commit()
    return _po_out(po)


@router.get("/purchase-orders", response_model=PageOut[PurchaseOrderOut])
def list_purchase_orders(
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
    q: Optional[str] = Query(default=None, description="Substring filter on PO number"),
    vendor_id: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
) -> PageOut[PurchaseOrderOut]:
    conditions = []
    search = q.strip() if q else None
    if search:
        conditions.append(MasterPurchaseOrder.po_number.ilike("%" + search + "%"))
    if vendor_id:
        conditions.append(MasterPurchaseOrder.vendor_id == vendor_id.upper())
    if status_filter:
        conditions.append(MasterPurchaseOrder.status.ilike("%" + status_filter + "%"))
    total = db.scalar(select(func.count()).select_from(MasterPurchaseOrder).where(*conditions)) or 0
    rows = db.scalars(
        select(MasterPurchaseOrder)
        .where(*conditions)
        .options(selectinload(MasterPurchaseOrder.lines))
        .order_by(MasterPurchaseOrder.po_number)
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    items = [_po_out(po) for po in rows]
    return PageOut[PurchaseOrderOut](
        items=items, total=total, page=page, size=size,
        pages=(total + size - 1) // size, count=len(items), search=search,
    )


@router.get("/purchase-orders/{po_number}", response_model=PurchaseOrderResponse)
def get_purchase_order(
    po_number: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> PurchaseOrderOut:
    po = db.scalar(
        select(MasterPurchaseOrder)
        .where(MasterPurchaseOrder.po_number == po_number.upper())
        .options(selectinload(MasterPurchaseOrder.lines))
    )
    if po is None:
        raise _not_found("Purchase order %s" % po_number)
    return _po_out(po)


@router.patch("/purchase-orders/{po_number}", response_model=PurchaseOrderResponse)
def update_purchase_order(
    po_number: str,
    payload: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> PurchaseOrderOut:
    po = db.scalar(
        select(MasterPurchaseOrder)
        .where(MasterPurchaseOrder.po_number == po_number.upper())
        .options(selectinload(MasterPurchaseOrder.lines))
    )
    if po is None:
        raise _not_found("Purchase order %s" % po_number)
    changes = payload.model_dump(exclude_unset=True, exclude={"lines"})
    for key, value in changes.items():
        setattr(po, key, value)

    if payload.lines is not None:
        for old in list(po.lines):
            db.delete(old)
        db.flush()
        new_lines = _po_lines_instances(po, payload.lines)
        po.lines.extend(new_lines)
        # Recompute totals unless the caller overrode them explicitly.
        if "subtotal" not in changes and "tax" not in changes:
            subtotal, tax, total = _po_totals(payload.lines, None, None)
            po.subtotal, po.tax, po.total = subtotal, tax, total

    write_audit(
        db, action="master.po.updated", actor=current_user,
        detail={"po_number": po.po_number, "fields": sorted(changes) or ["lines"]},
    )
    db.commit()
    db.refresh(po)
    return _po_out(po)


@router.delete("/purchase-orders/{po_number}")
def delete_purchase_order(
    po_number: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> dict:
    po = db.scalar(select(MasterPurchaseOrder).where(MasterPurchaseOrder.po_number == po_number.upper()))
    if po is None:
        raise _not_found("Purchase order %s" % po_number)
    db.delete(po)
    db.flush()
    write_audit(db, action="master.po.deleted", actor=current_user, detail={"po_number": po.po_number})
    db.commit()
    return {"success": True, "detail": "Purchase order %s deleted." % po.po_number}


# ============================================================================
# Goods receipts
# ============================================================================
@router.post("/goods-receipts", response_model=GoodsReceiptResponse, status_code=201)
def create_goods_receipt(
    payload: GoodsReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> MasterGoodsReceipt:
    duplicate = db.scalar(
        select(MasterGoodsReceipt).where(
            MasterGoodsReceipt.grn_number == payload.grn_number,
            MasterGoodsReceipt.po_number == payload.po_number,
            MasterGoodsReceipt.description == payload.description,
        )
    )
    if duplicate is not None:
        raise _conflict(
            "A receipt %s for PO %s with this description already exists." % (payload.grn_number, payload.po_number)
        )
    receipt = MasterGoodsReceipt(**payload.model_dump())
    db.add(receipt)
    db.flush()
    write_audit(
        db, action="master.receipt.created", actor=current_user,
        detail={"grn_number": receipt.grn_number, "po_number": receipt.po_number},
    )
    db.commit()
    db.refresh(receipt)
    return receipt


@router.get("/goods-receipts", response_model=PageOut[GoodsReceiptOut])
def list_goods_receipts(
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
    po_number: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None, description="Substring filter on GRN number"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
) -> PageOut[GoodsReceiptOut]:
    conditions = []
    search = q.strip() if q else None
    if po_number:
        conditions.append(MasterGoodsReceipt.po_number == po_number.upper())
    if search:
        conditions.append(MasterGoodsReceipt.grn_number.ilike("%" + search + "%"))
    total = db.scalar(select(func.count()).select_from(MasterGoodsReceipt).where(*conditions)) or 0
    rows = db.scalars(
        select(MasterGoodsReceipt)
        .where(*conditions)
        .order_by(MasterGoodsReceipt.grn_number, MasterGoodsReceipt.po_number)
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    items = [GoodsReceiptOut.model_validate(r) for r in rows]
    return PageOut[GoodsReceiptOut](
        items=items, total=total, page=page, size=size,
        pages=(total + size - 1) // size, count=len(items), search=search,
    )


@router.get("/goods-receipts/{receipt_id}", response_model=GoodsReceiptResponse)
def get_goods_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> MasterGoodsReceipt:
    receipt = db.get(MasterGoodsReceipt, receipt_id)
    if receipt is None:
        raise _not_found("Goods receipt")
    return receipt


@router.patch("/goods-receipts/{receipt_id}", response_model=GoodsReceiptResponse)
def update_goods_receipt(
    receipt_id: str,
    payload: GoodsReceiptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> MasterGoodsReceipt:
    receipt = db.get(MasterGoodsReceipt, receipt_id)
    if receipt is None:
        raise _not_found("Goods receipt")
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(receipt, key, value)
    write_audit(
        db, action="master.receipt.updated", actor=current_user,
        detail={"receipt_id": receipt.id, "fields": sorted(changes)},
    )
    db.commit()
    db.refresh(receipt)
    return receipt


@router.delete("/goods-receipts/{receipt_id}")
def delete_goods_receipt(
    receipt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> dict:
    receipt = db.get(MasterGoodsReceipt, receipt_id)
    if receipt is None:
        raise _not_found("Goods receipt")
    db.delete(receipt)
    db.flush()
    write_audit(db, action="master.receipt.deleted", actor=current_user, detail={"receipt_id": receipt_id})
    db.commit()
    return {"success": True, "detail": "Goods receipt deleted."}


# ============================================================================
# Processed invoices
# ============================================================================
@router.post("/processed-invoices", response_model=ProcessedInvoiceResponse, status_code=201)
def create_processed_invoice(
    payload: ProcessedInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> MasterProcessedInvoice:
    if db.scalar(select(MasterProcessedInvoice).where(MasterProcessedInvoice.internal_id == payload.internal_id)):
        raise _conflict("A processed-invoice record %s already exists." % payload.internal_id)
    record = MasterProcessedInvoice(**payload.model_dump())
    db.add(record)
    db.flush()
    write_audit(
        db, action="master.processed.created", actor=current_user,
        detail={"internal_id": record.internal_id, "invoice_number": record.invoice_number},
    )
    db.commit()
    db.refresh(record)
    return record


@router.get("/processed-invoices", response_model=PageOut[ProcessedInvoiceOut])
def list_processed_invoices(
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
    vendor_id: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None, description="Substring filter on invoice number"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
) -> PageOut[ProcessedInvoiceOut]:
    conditions = []
    search = q.strip() if q else None
    if vendor_id:
        conditions.append(MasterProcessedInvoice.vendor_id == vendor_id.upper())
    if search:
        conditions.append(MasterProcessedInvoice.invoice_number.ilike("%" + search + "%"))
    total = db.scalar(select(func.count()).select_from(MasterProcessedInvoice).where(*conditions)) or 0
    rows = db.scalars(
        select(MasterProcessedInvoice)
        .where(*conditions)
        .order_by(MasterProcessedInvoice.processing_date.desc().nulls_last(), MasterProcessedInvoice.invoice_number)
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    items = [ProcessedInvoiceOut.model_validate(r) for r in rows]
    return PageOut[ProcessedInvoiceOut](
        items=items, total=total, page=page, size=size,
        pages=(total + size - 1) // size, count=len(items), search=search,
    )


@router.get("/processed-invoices/{internal_id}", response_model=ProcessedInvoiceResponse)
def get_processed_invoice(
    internal_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer),
) -> MasterProcessedInvoice:
    record = db.scalar(
        select(MasterProcessedInvoice).where(MasterProcessedInvoice.internal_id == internal_id.upper())
    )
    if record is None:
        raise _not_found("Processed-invoice record %s" % internal_id)
    return record


@router.patch("/processed-invoices/{internal_id}", response_model=ProcessedInvoiceResponse)
def update_processed_invoice(
    internal_id: str,
    payload: ProcessedInvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> MasterProcessedInvoice:
    record = db.scalar(
        select(MasterProcessedInvoice).where(MasterProcessedInvoice.internal_id == internal_id.upper())
    )
    if record is None:
        raise _not_found("Processed-invoice record %s" % internal_id)
    changes = payload.model_dump(exclude_unset=True)
    for key, value in changes.items():
        setattr(record, key, value)
    write_audit(
        db, action="master.processed.updated", actor=current_user,
        detail={"internal_id": record.internal_id, "fields": sorted(changes)},
    )
    db.commit()
    db.refresh(record)
    return record


@router.delete("/processed-invoices/{internal_id}")
def delete_processed_invoice(
    internal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_reviewer),
) -> dict:
    record = db.scalar(
        select(MasterProcessedInvoice).where(MasterProcessedInvoice.internal_id == internal_id.upper())
    )
    if record is None:
        raise _not_found("Processed-invoice record %s" % internal_id)
    db.delete(record)
    db.flush()
    write_audit(db, action="master.processed.deleted", actor=current_user, detail={"internal_id": internal_id})
    db.commit()
    return {"success": True, "detail": "Processed-invoice record %s deleted." % internal_id}

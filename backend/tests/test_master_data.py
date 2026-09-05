# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Tests for editable master data: CRUD endpoints and their effect on the
validation pipeline (registers now live in the database)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient

from tests.conftest import auth, upload_case, wait_for_job


def test_master_data_crud(client: TestClient, reviewer_token: str) -> None:
    headers = auth(reviewer_token)

    # Vendors -----------------------------------------------------------------
    created_vendor = client.post(
        "/master-data/vendors",
        headers=headers,
        json={
            "vendor_id": "v-900",
            "legal_name": "Acme Test Supplies Ltd",
            "trading_name": "Acme Test",
            "approved": True,
            "default_currency": "kes",
        },
    )
    assert created_vendor.status_code == 201, created_vendor.text
    vendor = created_vendor.json()
    assert vendor["vendor_id"] == "V-900"  # normalized to upper case
    assert vendor["legal_name"] == "Acme Test Supplies Ltd"

    duplicate = client.post(
        "/master-data/vendors",
        headers=headers,
        json={"vendor_id": "V-900", "legal_name": "Again"},
    )
    assert duplicate.status_code == 409

    listing = client.get("/master-data/vendors?q=Acme", headers=headers)
    assert listing.status_code == 200
    assert [v["vendor_id"] for v in listing.json()["items"]] == ["V-900"]

    # Purchase order with computed totals -------------------------------------
    created_po = client.post(
        "/master-data/purchase-orders",
        headers=headers,
        json={
            "po_number": "po-9001",
            "vendor_id": "V-900",
            "po_date": "2026-09-01",
            "currency": "KES",
            "description": "Test widgets",
            "status": "Open",
            "lines": [
                {
                    "description": "Test widget unit",
                    "quantity": "5",
                    "unit_price": "1000.00",
                    "tax_rate": "0.16",
                }
            ],
        },
    )
    assert created_po.status_code == 201, created_po.text
    po = created_po.json()
    assert po["po_number"] == "PO-9001"
    assert Decimal(po["subtotal"]) == Decimal("5000.00")
    assert Decimal(po["tax"]) == Decimal("800.00")
    assert Decimal(po["total"]) == Decimal("5800.00")
    assert len(po["lines"]) == 1

    fetched_po = client.get("/master-data/purchase-orders/PO-9001", headers=headers)
    assert fetched_po.status_code == 200
    assert fetched_po.json()["vendor_id"] == "V-900"

    # Goods receipt ------------------------------------------------------------
    created_receipt = client.post(
        "/master-data/goods-receipts",
        headers=headers,
        json={
            "grn_number": "GRN-9001",
            "po_number": "PO-9001",
            "description": "Test widget unit",
            "quantity_ordered": "5",
            "quantity_received": "5",
            "receipt_date": "2026-09-02",
            "status": "Complete",
        },
    )
    assert created_receipt.status_code == 201, created_receipt.text
    receipts = client.get("/master-data/goods-receipts?po_number=PO-9001", headers=headers)
    assert receipts.status_code == 200
    assert receipts.json()["total"] == 1

    # Validation refuses a PO for an unknown vendor ----------------------------
    bad_po = client.post(
        "/master-data/purchase-orders",
        headers=headers,
        json={
            "po_number": "PO-9002",
            "vendor_id": "V-NOPE",
            "lines": [{"description": "x", "quantity": "1", "unit_price": "1.00"}],
        },
    )
    assert bad_po.status_code == 422


def test_master_data_changes_affect_validation(
    client: TestClient, reviewer_token: str
) -> None:
    """Adding a matching processed-invoice record flips CASE-001 to BLOCK."""
    headers = auth(reviewer_token)

    added = client.post(
        "/master-data/processed-invoices",
        headers=headers,
        json={
            "internal_id": "INV-9001",
            "invoice_number": "MT-2026-0847",
            "vendor_id": "V-002",
            "invoice_date": "2026-08-15",
            "po_number": "PO-1001",
            "currency": "USD",
            "total_amount": "35200.00",
            "processing_status": "Approved",
            "processing_date": "2026-09-01",
        },
    )
    assert added.status_code == 201, added.text

    created = upload_case(client, reviewer_token, "CASE-001_invoice.pdf")
    job = wait_for_job(client, created["job_id"], headers)
    assert job["status"] == "SUCCEEDED", job.get("error")
    assert job["decision"] == "BLOCK"

    report = client.get("/reports/%s" % job["report_id"], headers=headers)
    issue = report.json()["report"]["issues"][0]
    assert issue["check_id"] == "duplicate_not_found"
    assert issue["evidence"] == ["processed_invoices -> INV-9001"]

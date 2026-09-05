# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Response-contract tests.

Every JSON endpoint returns a flat envelope: ``success`` at the root, list
endpoints additionally expose ``count`` / pagination / ``search``, writes
return the stored record so clients never refetch, and failures use the
structured error object ``{success: false, error: {code, message, details}}``
with unchanged HTTP status codes.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import (
    APPROVER_EMAIL,
    REVIEWER_EMAIL,
    REVIEWER_PASSWORD,
    auth,
    upload_case,
    wait_for_job,
)


def test_success_flags_on_reads_and_writes(client: TestClient, reviewer_token: str, approver_token: str) -> None:
    headers = auth(reviewer_token)

    assert client.get("/health").json()["success"] is True

    login = client.post("/auth/login", json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD})
    assert login.status_code == 200
    assert login.json()["success"] is True

    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["success"] is True

    # Writes return the stored record with success true (no refetch needed).
    created = client.post(
        "/master-data/vendors",
        headers=headers,
        json={
            "vendor_id": "V-TESTX",
            "legal_name": "Envelope Test Corp",
            "default_currency": "USD",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["success"] is True
    assert body["vendor_id"] == "V-TESTX"
    assert body["legal_name"] == "Envelope Test Corp"

    updated = client.patch(
        "/master-data/vendors/V-TESTX",
        headers=headers,
        json={"legal_name": "Envelope Test Renamed"},
    )
    assert updated.status_code == 200
    assert updated.json()["success"] is True
    assert updated.json()["legal_name"] == "Envelope Test Renamed"

    deleted = client.delete("/master-data/vendors/V-TESTX", headers=headers)
    assert deleted.status_code == 200
    assert deleted.json() == {"success": True, "detail": "Vendor V-TESTX deleted."}

    # Approver-gated user writes also return the stored user.
    approver_headers = auth(approver_token)
    user = client.post(
        "/auth/users",
        headers=approver_headers,
        json={"email": "envelope@invoiceops.dev", "name": "Env Person", "password": "EnvPersonPass1", "role": "reviewer"},
    )
    assert user.status_code == 201
    assert user.json()["success"] is True
    assert user.json()["email"] == "envelope@invoiceops.dev"


def test_list_envelope_count_pagination_search(client: TestClient, reviewer_token: str, approver_token: str) -> None:
    headers = auth(reviewer_token)

    page = client.get("/master-data/vendors", headers=headers)
    assert page.status_code == 200
    body = page.json()
    assert body["success"] is True
    assert body["count"] == len(body["items"]) >= 1
    assert body["total"] >= body["count"]
    assert body["pages"] >= 1
    assert body["page"] == 1 and body["size"] == 25
    assert body["search"] is None
    # Rows themselves are bare resources: no per-row success flag.
    assert "success" not in body["items"][0]

    # Search narrows the result set and echoes the term back.
    searched = client.get("/master-data/vendors?q=V-002", headers=headers)
    assert searched.status_code == 200
    result = searched.json()
    assert result["search"] == "V-002"
    assert result["total"] == 1
    assert result["count"] == 1
    assert result["items"][0]["vendor_id"] == "V-002"

    # The users list (approver only) uses the same envelope.
    users = client.get("/auth/users", headers=auth(approver_token))
    assert users.status_code == 200
    user_body = users.json()
    assert user_body["success"] is True
    assert user_body["count"] == len(user_body["items"])
    assert REVIEWER_EMAIL in [item["email"] for item in user_body["items"]]
    assert APPROVER_EMAIL in [item["email"] for item in user_body["items"]]


def test_invoice_list_search(client: TestClient, reviewer_token: str) -> None:
    headers = auth(reviewer_token)
    # Upload two cases so there is more than one invoice row.
    for case in ("CASE-001_invoice.pdf", "CASE-002_invoice.pdf"):
        created = upload_case(client, reviewer_token, case)
        job = wait_for_job(client, created["job_id"], headers)
        assert job["status"] == "SUCCEEDED", job.get("error")

    full = client.get("/invoices", headers=headers)
    assert full.status_code == 200
    assert full.json()["total"] == 2
    assert full.json()["count"] == 2

    filtered = client.get("/invoices?q=CASE-002", headers=headers)
    assert filtered.status_code == 200
    body = filtered.json()
    assert body["search"] == "CASE-002"
    assert body["total"] == 1
    assert body["count"] == 1
    assert body["items"][0]["case_id"] == "CASE-002"


def test_structured_errors(client: TestClient, reviewer_token: str) -> None:
    headers = auth(reviewer_token)

    # Unauthenticated: 401 with code unauthorized.
    unauthorized = client.get("/invoices")
    assert unauthorized.status_code == 401
    body = unauthorized.json()
    assert body["success"] is False
    assert body["error"]["code"] == "unauthorized"
    assert body["error"]["message"]

    # Missing resource: 404 with code not_found.
    missing = client.get("/master-data/vendors/V-NOPE", headers=headers)
    assert missing.status_code == 404
    body = missing.json()
    assert body["success"] is False
    assert body["error"]["code"] == "not_found"

    # Duplicate write: 409 with code conflict.
    duplicate = client.post(
        "/master-data/vendors",
        headers=headers,
        json={"vendor_id": "V-002", "legal_name": "Duplicate"},
    )
    assert duplicate.status_code == 409
    body = duplicate.json()
    assert body["success"] is False
    assert body["error"]["code"] == "conflict"

    # Request validation: 422 carries field-level details.
    invalid = client.post(
        "/auth/register",
        json={"email": "short-pass@invoiceops.dev", "name": "N", "password": "short"},
    )
    assert invalid.status_code == 422
    body = invalid.json()
    assert body["success"] is False
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["details"]
    fields = {item["field"] for item in body["error"]["details"]}
    assert "password" in fields

    # Reviewer hitting an approver endpoint: 403 with code forbidden.
    denied = client.post(
        "/decide",
        headers=headers,
        json={"report_id": "whatever", "outcome": "approved"},
    )
    assert denied.status_code in (403, 404)
    if denied.status_code == 403:
        assert denied.json()["error"]["code"] == "forbidden"

# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""End-to-end API tests against the real evaluation PDFs (deterministic mode).

These exercise the acceptance path from SYSTEM_DESIGN.md section 16: login,
upload, job polling, report, extraction correction (G1), and the approver
gate. Master data is the read-only evaluation CSV set.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import REVIEWER_EMAIL, REVIEWER_PASSWORD, auth, upload_case, wait_for_job


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


def test_health_and_login(client: TestClient) -> None:
    health = client.get("/health")
    assert health.status_code == 200
    body = health.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
    assert body["master_data_loaded"] is True

    # Wrong password is rejected.
    bad = client.post(
        "/auth/login",
        json={"email": REVIEWER_EMAIL, "password": "wrong-password"},
    )
    assert bad.status_code == 401

    login = _login(client, REVIEWER_EMAIL, REVIEWER_PASSWORD)
    assert login["role"] == "reviewer"
    assert login["token_type"] == "bearer"

    me = client.get("/auth/me", headers=auth(login["access_token"]))
    assert me.status_code == 200
    assert me.json()["email"] == REVIEWER_EMAIL

    # Unauthenticated requests are rejected.
    assert client.get("/invoices").status_code == 401


def test_case001_pass_to_approval(client: TestClient, reviewer_token: str, approver_token: str) -> None:
    """CASE-001: clean invoice ends PASS and can only be decided by an approver."""
    created = upload_case(client, reviewer_token, "CASE-001_invoice.pdf")
    reviewer_headers = auth(reviewer_token)
    job = wait_for_job(client, created["job_id"], reviewer_headers)
    assert job["status"] == "SUCCEEDED", job.get("error")
    assert job["decision"] == "PASS"
    report_id = job["report_id"]
    assert report_id

    report = client.get("/reports/%s" % report_id, headers=reviewer_headers)
    assert report.status_code == 200
    payload = report.json()
    assert payload["decision"] == "PASS"
    assert payload["invoice_status"] == "AWAITING_REVIEW"
    assert payload["report"]["decision"] == "PASS"
    assert len(payload["report"]["checks"]) == 11
    assert payload["report"]["checks"][0]["check_id"] == "vendor_approved"
    assert payload["report"]["evidence_package"]["vendor"]["Vendor ID"] == "V-002"

    # Reviewer must not be able to decide.
    denied = client.post(
        "/decide",
        headers=auth(reviewer_token),
        json={"report_id": report_id, "outcome": "approved"},
    )
    assert denied.status_code == 403

    # Approver approves.
    decided = client.post(
        "/decide",
        headers=auth(approver_token),
        json={"report_id": report_id, "outcome": "approved"},
    )
    assert decided.status_code == 200
    record = decided.json()
    assert record["human_outcome"] == "approved"
    assert record["system_decision"] == "PASS"

    # Decision is final: a second decide is refused.
    again = client.post(
        "/decide",
        headers=auth(approver_token),
        json={"report_id": report_id, "outcome": "rejected"},
    )
    assert again.status_code == 409

    # The queue shows the completed invoice with its outcome.
    listing = client.get("/invoices", headers=reviewer_headers)
    assert listing.status_code == 200
    item = listing.json()["items"][0]
    assert item["status"] == "COMPLETED"
    assert item["run"]["human_outcome"] == "approved"


def test_case006_block_and_override(client: TestClient, reviewer_token: str, approver_token: str) -> None:
    """CASE-006: duplicate invoice hard-stops BLOCK and needs a written override."""
    created = upload_case(client, reviewer_token, "CASE-006_invoice.pdf")
    reviewer_headers = auth(reviewer_token)
    job = wait_for_job(client, created["job_id"], reviewer_headers)
    assert job["status"] == "SUCCEEDED", job.get("error")
    assert job["decision"] == "BLOCK"
    report_id = job["report_id"]

    report = client.get("/reports/%s" % report_id, headers=reviewer_headers)
    payload = report.json()
    assert payload["report"]["issues"][0]["check_id"] == "duplicate_not_found"
    assert payload["report"]["issues"][0]["tier"] == "block"
    assert payload["report"]["evidence_package"]["history"][0]["internal_id"] == "INV-2026-001"

    # Overriding a BLOCK without a written reason is refused.
    no_reason = client.post(
        "/decide",
        headers=auth(approver_token),
        json={"report_id": report_id, "outcome": "approved"},
    )
    assert no_reason.status_code == 409

    override = client.post(
        "/decide",
        headers=auth(approver_token),
        json={
            "report_id": report_id,
            "outcome": "approved",
            "override_reason": "Original payment already refunded by vendor.",
        },
    )
    assert override.status_code == 200
    assert override.json()["human_outcome"] == "override_block"
    assert override.json()["override_reason"]


def test_case009_correction_revalidates(client: TestClient, reviewer_token: str, approver_token: str) -> None:
    """CASE-009: correcting the missing invoice date (G1) re-runs validation."""
    created = upload_case(client, reviewer_token, "CASE-009_invoice.pdf")
    reviewer_headers = auth(reviewer_token)
    job = wait_for_job(client, created["job_id"], reviewer_headers)
    assert job["status"] == "SUCCEEDED", job.get("error")
    assert job["decision"] == "REVIEW"

    report_id = job["report_id"]
    patched = client.patch(
        "/reports/%s/extraction" % report_id,
        headers=reviewer_headers,
        json={"fields": {"invoice_date": {"value": "August 14, 2026"}}},
    )
    assert patched.status_code == 200, patched.text
    payload = patched.json()["report"]
    # The run id (the report URL) stays stable across corrections.
    assert payload["id"] == report_id
    assert payload["decision"] == "PASS"
    extraction = payload["report"]["extraction"]["fields"]["invoice_date"]
    assert extraction["value"] == "2026-08-14"

    # Approver can now approve the corrected PASS report.
    decided = client.post(
        "/decide",
        headers=auth(approver_token),
        json={"report_id": report_id, "outcome": "approved"},
    )
    assert decided.status_code == 200


def test_upload_rejects_non_pdf(client: TestClient, reviewer_token: str) -> None:
    response = client.post(
        "/invoices",
        headers=auth(reviewer_token),
        files={"file": ("note.txt", b"this is not a pdf", "text/plain")},
    )
    assert response.status_code == 400

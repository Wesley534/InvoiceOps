# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Tests for user provisioning: open reviewer registration, approver-only
user management, and env-seeded approver credentials."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tests.conftest import APPROVER_EMAIL, APPROVER_PASSWORD, REVIEWER_EMAIL, REVIEWER_PASSWORD, auth


def _register(client: TestClient, email: str, name: str = "New Person", password: str = "BrandNewPass-2026") -> dict:
    response = client.post(
        "/auth/register",
        json={"email": email, "name": name, "password": password},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_register_creates_reviewer_only(client: TestClient) -> None:
    token_body = _register(client, "newbie@invoiceops.dev")
    assert token_body["role"] == "reviewer"
    assert token_body["name"] == "New Person"

    # The new reviewer can call authenticated endpoints but never decide.
    headers = auth(token_body["access_token"])
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "reviewer"

    denied = client.post(
        "/decide",
        headers=headers,
        json={"report_id": "any", "outcome": "approved"},
    )
    assert denied.status_code in (403, 404)

    # Role is never client-supplied: an extra "role" field is ignored.
    claimed = client.post(
        "/auth/register",
        json={
            "email": "wannabe-approver@invoiceops.dev",
            "name": "Wannabe",
            "password": "BrandNewPass-2026",
            "role": "approver",
        },
    )
    assert claimed.status_code == 201
    assert claimed.json()["role"] == "reviewer"


def test_register_rejects_duplicate_and_weak_password(client: TestClient) -> None:
    _register(client, "dup@invoiceops.dev")
    again = client.post(
        "/auth/register",
        json={"email": "dup@invoiceops.dev", "name": "Dup", "password": "BrandNewPass-2026"},
    )
    assert again.status_code == 409

    weak = client.post(
        "/auth/register",
        json={"email": "weak@invoiceops.dev", "name": "Weak", "password": "short"},
    )
    assert weak.status_code == 422


def test_reviewer_cannot_manage_users(client: TestClient, reviewer_token: str) -> None:
    headers = auth(reviewer_token)
    denied = (
        client.get("/auth/users", headers=headers),
        client.post(
            "/auth/users",
            headers=headers,
            json={"email": "x@invoiceops.dev", "name": "X", "password": "BrandNewPass-2026", "role": "reviewer"},
        ),
        client.patch("/auth/users/some-id", headers=headers, json={"role": "approver"}),
    )
    for response in denied:
        assert response.status_code == 403, response.text


def test_approver_provisions_users_and_promotes(client: TestClient, approver_token: str) -> None:
    headers = auth(approver_token)

    # Approver can create a user of either role.
    created = client.post(
        "/auth/users",
        headers=headers,
        json={"email": "ops@invoiceops.dev", "name": "Ops Person", "password": "OpsPass-2026", "role": "reviewer"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["role"] == "reviewer"

    second = client.post(
        "/auth/users",
        headers=headers,
        json={"email": "boss@invoiceops.dev", "name": "Boss", "password": "BossPass-2026", "role": "approver"},
    )
    assert second.status_code == 201
    assert second.json()["role"] == "approver"

    # Listing shows the seeded users plus the new ones.
    listing = client.get("/auth/users", headers=headers)
    assert listing.status_code == 200
    emails = [item["email"] for item in listing.json()["items"]]
    assert REVIEWER_EMAIL in emails
    assert APPROVER_EMAIL in emails
    assert "ops@invoiceops.dev" in emails

    # Promote the reviewer to approver, then demote back to reviewer.
    promoted = client.patch(
        "/auth/users/%s" % body["id"],
        headers=headers,
        json={"role": "approver"},
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "approver"

    demoted = client.patch(
        "/auth/users/%s" % body["id"],
        headers=headers,
        json={"role": "reviewer", "is_active": False},
    )
    assert demoted.status_code == 200
    assert demoted.json()["role"] == "reviewer"
    assert demoted.json()["is_active"] is False

    # A deactivated account can no longer log in.
    inactive = client.post(
        "/auth/login",
        json={"email": "ops@invoiceops.dev", "password": "OpsPass-2026"},
    )
    assert inactive.status_code == 401

    # Approvers cannot edit their own account through this endpoint.
    me = client.get("/auth/me", headers=headers)
    assert me.status_code == 200
    self_edit = client.patch(
        "/auth/users/%s" % me.json()["id"],
        headers=headers,
        json={"role": "reviewer"},
    )
    assert self_edit.status_code == 400

    # Password reset via PATCH takes effect for the next login.
    reset = client.post(
        "/auth/users",
        headers=headers,
        json={"email": "reset-me@invoiceops.dev", "name": "Reset Me", "password": "ResetPass-2026", "role": "reviewer"},
    )
    assert reset.status_code == 201
    patched = client.patch(
        "/auth/users/%s" % reset.json()["id"],
        headers=headers,
        json={"password": "ChangedPass-2026"},
    )
    assert patched.status_code == 200
    old_login = client.post(
        "/auth/login",
        json={"email": "reset-me@invoiceops.dev", "password": "ResetPass-2026"},
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/auth/login",
        json={"email": "reset-me@invoiceops.dev", "password": "ChangedPass-2026"},
    )
    assert new_login.status_code == 200


def test_seeded_credentials_from_env(client: TestClient) -> None:
    """The approver provisioned by the seed script logs in with the env-set
    credentials (SEED_APPROVER_*), not a hard-coded default."""
    for email, password in (
        (REVIEWER_EMAIL, REVIEWER_PASSWORD),
        (APPROVER_EMAIL, APPROVER_PASSWORD),
    ):
        login = client.post("/auth/login", json={"email": email, "password": password})
        assert login.status_code == 200, (email, login.text)
        body = login.json()
        if email == APPROVER_EMAIL:
            assert body["role"] == "approver"
        else:
            assert body["role"] == "reviewer"

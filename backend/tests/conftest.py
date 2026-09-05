# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Shared pytest fixtures.

Environment must be configured BEFORE any ``app`` module is imported because
the process-wide settings are cached on first read. pytest imports conftest
before test modules, so setting environment at the top of this file is safe.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Configure the environment first (no app imports above this point).
# ---------------------------------------------------------------------------
# tests/ -> backend/ -> InvoiceOps/ -> must/ (repo root)
TESTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = TESTS_DIR.parents[1]  # InvoiceOps/
REPO_ROOT = TESTS_DIR.parents[2]  # must/ (parent of InvoiceOps)

_TEST_UPLOADS = TESTS_DIR / "_tmp_uploads"
_DATASET_DIR = REPO_ROOT / "invoiceops-evaluation-dataset"
_TEST_DB = TESTS_DIR / "_tmp_invoiceops_test.db"

for _dir in (_TEST_UPLOADS,):
    _dir.mkdir(parents=True, exist_ok=True)

os.environ["APP_ENV"] = "test"
os.environ["DEBUG"] = "false"
os.environ["LOG_LEVEL"] = "WARNING"
os.environ["DATABASE_URL"] = "sqlite:///%s" % _TEST_DB
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production-0123456789abcdef"
os.environ["UPLOAD_DIR"] = str(_TEST_UPLOADS)
os.environ["MASTER_DATA_DIR"] = str(_DATASET_DIR / "master_data")
os.environ["CONTRACTS_DIR"] = str(PROJECT_ROOT / "contracts")
os.environ["NVIDIA_API_KEY"] = ""
os.environ["SEED_REVIEWER_EMAIL"] = "reviewer@invoiceops.dev"
os.environ["SEED_REVIEWER_PASSWORD"] = "reviewer-test-pass"
os.environ["SEED_REVIEWER_NAME"] = "Test Reviewer"
os.environ["SEED_APPROVER_EMAIL"] = "approver@invoiceops.dev"
os.environ["SEED_APPROVER_PASSWORD"] = "approver-test-pass"
os.environ["SEED_APPROVER_NAME"] = "Test Approver"

# Now safe to import the application.
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import create_session, engine  # noqa: E402
from app.initial_data import seed_users  # noqa: E402
from app.main import app  # noqa: E402

REVIEWER_EMAIL = os.environ["SEED_REVIEWER_EMAIL"]
REVIEWER_PASSWORD = os.environ["SEED_REVIEWER_PASSWORD"]
APPROVER_EMAIL = os.environ["SEED_APPROVER_EMAIL"]
APPROVER_PASSWORD = os.environ["SEED_APPROVER_PASSWORD"]


@pytest.fixture(scope="session", autouse=True)
def _fresh_database():
    if _TEST_DB.exists():
        _TEST_DB.unlink()
    Base.metadata.create_all(bind=engine())
    yield
    Base.metadata.drop_all(bind=engine())


@pytest.fixture(autouse=True)
def _clean_state():
    """Wipe all tables between tests; reseed users and master data from CSV."""
    db = create_session()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    finally:
        db.close()
    seed_users()
    from app.import_master_data import import_master_data

    import_master_data()
    yield
    for leftover in _TEST_UPLOADS.glob("*.pdf"):
        leftover.unlink(missing_ok=True)


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def reviewer_token(client: TestClient) -> str:
    return _login(client, REVIEWER_EMAIL, REVIEWER_PASSWORD)["access_token"]


@pytest.fixture
def approver_token(client: TestClient) -> str:
    return _login(client, APPROVER_EMAIL, APPROVER_PASSWORD)["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": "Bearer " + token}


def wait_for_job(client: TestClient, job_id: str, headers: dict, timeout_seconds: float = 90.0) -> dict:
    """Poll the job until it reaches a terminal state."""
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        response = client.get("/jobs/%s" % job_id, headers=headers)
        assert response.status_code == 200, response.text
        job = response.json()
        if job["status"] in ("SUCCEEDED", "FAILED"):
            return job
        time.sleep(0.1)
    raise AssertionError("Job %s did not finish within %.0fs" % (job_id, timeout_seconds))


def upload_case(client: TestClient, token: str, filename: str) -> dict:
    case_pdf = _DATASET_DIR / "invoices" / filename
    with case_pdf.open("rb") as handle:
        response = client.post(
            "/invoices",
            headers=auth(token),
            files={"file": (filename, handle, "application/pdf")},
        )
    assert response.status_code == 201, response.text
    return response.json()

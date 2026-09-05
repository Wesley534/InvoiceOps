# Copyright (c) 2026 InvoiceOps. All rights reserved.
"""Run the 12 evaluation invoices end-to-end through the real API.

This is the design's evaluation runner (SYSTEM_DESIGN.md section 14/15): it
boots the FastAPI app in-process, uploads every invoice PDF from the dataset,
polls each background job to completion, and prints a decision table.

Usage (from backend/):
    .venv/bin/python scripts/evaluate_cases.py

Expected decisions come from the published EVALUATION_RUBRIC.md (CASE-005,
CASE-006 and CASE-012 accept REVIEW or BLOCK; CASE-010 accepts REVIEW or PASS
with reasoning). This script never opens the ground-truth CSV.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

PROJECT_ROOT = BACKEND_DIR.parent
REPO_ROOT = PROJECT_ROOT.parent

_EVAL_DIR = BACKEND_DIR / "var" / "evaluation"
_EVAL_DIR.mkdir(parents=True, exist_ok=True)

os.environ["APP_ENV"] = "test"
os.environ["DEBUG"] = "false"
os.environ["LOG_LEVEL"] = "WARNING"
os.environ["DATABASE_URL"] = "sqlite:///%s" % (_EVAL_DIR / "evaluation.db")
os.environ["SECRET_KEY"] = "evaluation-only-secret-key-0123456789abcdef-0123456789"
os.environ["UPLOAD_DIR"] = str(_EVAL_DIR / "uploads")
os.environ["MASTER_DATA_DIR"] = str(REPO_ROOT / "invoiceops-evaluation-dataset" / "master_data")
os.environ["CONTRACTS_DIR"] = str(PROJECT_ROOT / "contracts")
os.environ["NVIDIA_API_KEY"] = ""
os.environ["SEED_REVIEWER_EMAIL"] = "reviewer@invoiceops.dev"
os.environ["SEED_REVIEWER_PASSWORD"] = "reviewer-eval-pass"
os.environ["SEED_APPROVER_EMAIL"] = "approver@invoiceops.dev"
os.environ["SEED_APPROVER_PASSWORD"] = "approver-eval-pass"

from fastapi.testclient import TestClient  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.initial_data import seed_users  # noqa: E402
from app.main import app  # noqa: E402

# Accepted decisions per the published rubric. REVIEW/BLOCK both acceptable
# for the three hard-stop cases; CASE-010 is a degraded scan.
EXPECTED = {
    "CASE-001": {"PASS"},
    "CASE-002": {"PASS"},
    "CASE-003": {"PASS"},
    "CASE-004": {"REVIEW"},
    "CASE-005": {"REVIEW", "BLOCK"},
    "CASE-006": {"REVIEW", "BLOCK"},
    "CASE-007": {"REVIEW"},
    "CASE-008": {"REVIEW"},
    "CASE-009": {"REVIEW"},
    "CASE-010": {"REVIEW", "PASS"},
    "CASE-011": {"REVIEW"},
    "CASE-012": {"REVIEW", "BLOCK"},
}

INVOICES_DIR = REPO_ROOT / "invoiceops-evaluation-dataset" / "invoices"


def main() -> int:
    db_file = _EVAL_DIR / "evaluation.db"
    if db_file.exists():
        db_file.unlink()
    Base.metadata.create_all(bind=engine())
    seed_users()
    from app.import_master_data import import_master_data

    import_master_data()

    with TestClient(app) as client:
        login = client.post(
            "/auth/login",
            json={
                "email": os.environ["SEED_APPROVER_EMAIL"],
                "password": os.environ["SEED_APPROVER_PASSWORD"],
            },
        )
        login.raise_for_status()
        headers = {"Authorization": "Bearer " + login.json()["access_token"]}

        rows = []
        for pdf in sorted(INVOICES_DIR.glob("*.pdf")):
            case = pdf.name.split("_")[0]
            started = time.monotonic()
            with pdf.open("rb") as handle:
                uploaded = client.post(
                    "/invoices",
                    headers=headers,
                    files={"file": (pdf.name, handle, "application/pdf")},
                )
            uploaded.raise_for_status()
            job_id = uploaded.json()["job_id"]

            job = None
            while True:
                polled = client.get("/jobs/%s" % job_id, headers=headers)
                polled.raise_for_status()
                job = polled.json()
                if job["status"] in ("SUCCEEDED", "FAILED"):
                    break
                time.sleep(0.1)
            elapsed = time.monotonic() - started

            if job["status"] == "SUCCEEDED":
                client.get("/reports/%s" % job["report_id"], headers=headers).raise_for_status()

            decision = job.get("decision") or "ERROR"
            accepted = decision in EXPECTED.get(case, set())
            rows.append((case, job["status"], decision, job.get("error") or "", accepted, elapsed))

        # Table
        print("%-10s %-9s %-7s %-6s %-9s %8s" % ("case", "job", "decision", "ok", "issues", "time_s"))
        for case, job_status, decision, error, accepted, elapsed in rows:
            print(
                "%-10s %-9s %-7s %-6s %-9s %8.2f"
                % (case, job_status, decision, "yes" if accepted else "NO", "", elapsed)
            )

        n_correct = sum(1 for r in rows if r[3] == "" and r[4])
        n_failed_jobs = sum(1 for r in rows if r[1] == "FAILED")
        print()
        print("decision accuracy: %d/12" % n_correct)
        print("failed jobs: %d" % n_failed_jobs)
        return 0 if n_correct == 12 and n_failed_jobs == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

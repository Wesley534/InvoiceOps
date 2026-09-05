# InvoiceOps

**AI-assisted vendor invoice pre-approval validation** — InvoiceOps reviews vendor invoices against Meridian Technologies' master data and recommends **PASS / REVIEW / BLOCK** with an evidence package. It is advisory only: a human (approver role) makes the final decision.

**Stack:** React SPA (Vite) on Netlify/Vercel → FastAPI on a VPS → database (SQLite or MySQL via `DATABASE_URL`) + NVIDIA API (LLM). See `SYSTEM_DESIGN.md` for the full design (Mermaid diagrams for architecture, end-to-end flow, state machines, and storage).

## Status

- **Discovery & baseline** — Complete (see `invoiceops-evaluation-dataset/DAY1_DISCOVER_MAP_BASELINE.md`)
- **System design + data contracts** — Complete (`SYSTEM_DESIGN.md`)
- **Backend (FastAPI, models, Alembic, SQLite/MySQL, Docker, pipeline, API)** — Implemented. See `backend/README.md`. Master data is stored in the database and editable by users via `/master-data/*` (vendors, purchase orders, goods receipts, processed invoices).
- **v0 web happy path (CASE-001 end-to-end)** — Verified through the backend API (PASS report, approver gate, audit log)
- **Working core (API, jobs, pipeline)** — Running; React SPA still to build
- **Evaluation (12-case regression + baselines)** — `backend/scripts/evaluate_cases.py` runs the 12-case matrix through the API (12/12 decisions, 0 failed jobs)
- **Handoff (runbook, demo, case study)** — Pending

## What's in this repo

```
InvoiceOps/
├── SYSTEM_DESIGN.md                ← 18-section architecture & design
│                                      (architecture, data flow, stack + rationale, ADR,
│                                       contracts, AI-vs-app split, HITL, fallbacks,
│                                       privacy, state machine, storage, UI, eval, v0 scope)
├── contracts/                      ← versioned data contracts (JSON Schema)
│   ├── invoice_extraction.schema.json
│   ├── validation_report.schema.json
│   ├── decision_log.schema.json
│   └── evaluation_result.schema.json
├── backend/                        ← FastAPI backend (see backend/README.md)
│   ├── app/                        ← api routers, models, schemas, services, pipeline
│   ├── alembic/                    ← engine-agnostic migrations (SQLite + MySQL)
│   ├── tests/                      ← integration tests over the evaluation PDFs
│   ├── scripts/evaluate_cases.py   ← 12-case API evaluation runner
│   ├── Dockerfile
│   └── README.md                   ← setup, runbook, env vars, endpoints
├── docker-compose.yml              ← API + SQLite (default)
├── docker-compose.mysql.yml        ← overlay switching the API to MySQL
└── .env.example                    ← compose/docker configuration template
```

## Design in one paragraph

A **React SPA** (static on Netlify/Vercel) talks to a **FastAPI backend on a VPS**. Uploading a PDF creates a background job whose progress the UI polls; the backend runs six stages — intake, extraction, 11 deterministic checks, classification, evidence report, human gate. Field extraction is AI-assisted via the **NVIDIA API** (`llama-3.3-70b-instruct` text repair + Qwen2.5-VL vision for degraded scans, behind a swappable `LLMClient`); validation is 11 deterministic, threshold-driven rules with **no LLM in the decision path**. Login enforces **roles** (reviewer / approver); only approvers can approve/reject or override a BLOCK. Outcomes are appended to the **database** (SQLite by default, or MySQL — selected via the `DATABASE_URL` env var) on the VPS. Master data lives in database registers seeded from CSVs and editable via the `/master-data/*` API. Requires `NVIDIA_API_KEY` on the backend for AI-assisted extraction (deterministic-only mode otherwise).

## Key documents elsewhere

- Baseline & test cases: `../invoiceops-evaluation-dataset/DAY1_DISCOVER_MAP_BASELINE.md`
- Evaluation dataset (invoices, master data, rubric, ground truth): `../invoiceops-evaluation-dataset/`
- Meridian invoice policy: `../invoiceops-evaluation-dataset/company/invoice_processing_policy.pdf`

## Next step

Build the React SPA (design step 13): login → upload → live job progress → report detail with evidence → approver approve/reject → queue/history, against the API documented in `backend/README.md`.

Quick backend start (SQLite, no Docker):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/alembic upgrade head
.venv/bin/python -m app.initial_data
.venv/bin/uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
```

Docker: `docker compose up --build -d` (SQLite) or `docker compose -f docker-compose.yml -f docker-compose.mysql.yml up --build -d` (MySQL).
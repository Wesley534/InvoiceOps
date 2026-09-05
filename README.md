# InvoiceOps

**AI-assisted vendor invoice pre-approval validation** — InvoiceOps reviews vendor invoices against Meridian Technologies' master data and recommends **PASS / REVIEW / BLOCK** with an evidence package. It is advisory only: a human (approver role) makes the final decision.

**Stack:** React SPA (Vite) on Netlify/Vercel → FastAPI on a VPS → database (SQLite or MySQL via `DATABASE_URL`) + NVIDIA API (LLM). See `SYSTEM_DESIGN.md` for the full design (Mermaid diagrams for architecture, end-to-end flow, state machines, and storage).

## Status

- **Discovery & baseline** — Complete (see `invoiceops-evaluation-dataset/DAY1_DISCOVER_MAP_BASELINE.md`)
- **System design + data contracts** — Complete (`SYSTEM_DESIGN.md`)
- **v0 web happy path (CASE-001 end-to-end)** — Specified in design §15–16, build deferred
- **Working core (API, jobs, UI)** — Pending
- **Evaluation (12-case regression + baselines)** — Pending
- **Handoff (runbook, demo, case study)** — Pending

## What's in this repo

```
InvoiceOps/
├── SYSTEM_DESIGN.md                ← 18-section architecture & design
│                                      (architecture, data flow, stack + rationale, ADR,
│                                       contracts, AI-vs-app split, HITL, fallbacks,
│                                       privacy, state machine, storage, UI, eval, v0 scope)
└── contracts/                      ← versioned data contracts (JSON Schema)
    ├── invoice_extraction.schema.json
    ├── validation_report.schema.json
    ├── decision_log.schema.json
    └── evaluation_result.schema.json
```

## Design in one paragraph

A **React SPA** (static on Netlify/Vercel) talks to a **FastAPI backend on a VPS**. Uploading a PDF creates a background job whose progress the UI polls; the backend runs six stages — intake, extraction, 11 deterministic checks, classification, evidence report, human gate. Field extraction is AI-assisted via the **NVIDIA API** (`llama-3.3-70b-instruct` text repair + Qwen2.5-VL vision for degraded scans, behind a swappable `LLMClient`); validation is 11 deterministic, threshold-driven rules with **no LLM in the decision path**. Login enforces **roles** (reviewer / approver); only approvers can approve/reject or override a BLOCK. Outcomes are appended to the **database** (SQLite by default, or MySQL — selected via the `DATABASE_URL` env var) on the VPS. Master data CSVs are read-only. Requires `NVIDIA_API_KEY` on the backend.

## Key documents elsewhere

- Baseline & test cases: `../invoiceops-evaluation-dataset/DAY1_DISCOVER_MAP_BASELINE.md`
- Evaluation dataset (invoices, master data, rubric, ground truth): `../invoiceops-evaluation-dataset/`
- Meridian invoice policy: `../invoiceops-evaluation-dataset/company/invoice_processing_policy.pdf`

## Next step

Build the v0 web happy path per design §15–16: login → upload CASE-001 → live progress → PASS report with evidence → approver approves → logged. See `SYSTEM_DESIGN.md` §16 for the exact demo scenario and §17 for the implementation order.
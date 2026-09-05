# InvoiceOps — System Design

AI-assisted vendor invoice pre-approval validation.

**Inputs used:** the discovery and baseline document (`invoiceops-evaluation-dataset/DAY1_DISCOVER_MAP_BASELINE.md`), the evaluation dataset (master data CSVs, invoice PDFs, `EVALUATION_RUBRIC.md`), and Meridian's `invoice_processing_policy.pdf`.

**LLM provider (fixed):** NVIDIA API (NVIDIA NIM hosted inference, `build.nvidia.com`), OpenAI-compatible. The AI layer is designed around NVIDIA but kept provider-loosely-coupled behind a client seam.

**Interface (user-selected):** React SPA (Vite) frontend + FastAPI backend. **Hosting:** backend on the user's own VPS; frontend static on Netlify/Vercel. **Auth:** simple login with roles. **Processing UX:** background job with live progress.

---

# 1. Problem → System Translation

## The workflow in one sentence

> When a vendor invoice PDF arrives, the system extracts its fields, cross-checks them against four master-data registers (vendor, PO, goods receipt, processed history), runs 11 validation rules, and produces a **PASS / REVIEW / BLOCK recommendation with an evidence package** — then a human makes the final call.

## Translation map

| Workflow element | System element |
|---|---|
| **Trigger** | Reviewer uploads an invoice PDF in the web app (or drops it into `inbox/` on the server) — the same handler for every invoice, so it is a repeatable system, not a one-off prompt |
| **Input** | Vendor invoice PDF (browser upload) + 4 master-data CSVs (deployed with the backend, read-only) |
| **Processing steps** | Ingest → Extract → Validate (11 checks) → Classify → Report → Human gate → Log |
| **AI tasks** | Field extraction and repair from unstructured document text/images (see §7 for the strict boundary) |
| **Deterministic tasks** | All 11 validation checks, decision classification, report assembly, job scheduling, state transitions, auth |
| **Decisions** | PASS / REVIEW / BLOCK (rule-based, table-driven — not LLM-judged) |
| **Human decisions** | Final approve/reject (approver role), BLOCK overrides, correction of low-confidence extraction (reviewer role) |
| **Tools** | React SPA, FastAPI, `pdftotext` (text layer), optional OCR, NVIDIA API (LLM + vision), SQLite/MySQL (env-selected), CSV loader |
| **Data storage** | Master data = CSVs (read-only source of truth); run data = the configured database (SQLite or MySQL, env-selected) + `uploads/` on the VPS |
| **Output** | Validation report (JSON + Markdown/HTML) with evidence package, viewable in the web UI |
| **Exceptions** | Missing PO, unapproved vendor, duplicate, qty/amount mismatch, arithmetic error, missing field, degraded scan, currency mismatch, prompt injection — each maps to a failing check + tier |

## What the AI should do vs. what application code should do

| Concern | Owner | Why |
|---|---|---|
| Read invoice PDF | App (pdftotext on the backend) | Deterministic, free, offline, reproducible |
| Parse fields from clean text | **App** (regex/positional) | 11 of 12 evaluation PDFs have a clean text layer; regex is exact and auditable |
| Repair/complete ambiguous fields | **AI** (NVIDIA) | Unstructured variation is where rules fail |
| Read degraded/scanned pages | **AI** (NVIDIA vision) | Image understanding is an AI capability |
| All 11 validation checks | **App** | Thresholds come from Meridian policy; must be deterministic, testable, and independent of model behavior |
| PASS/REVIEW/BLOCK classification | **App** | Table-driven tier rules; the model must never decide |
| Issue descriptions / reasoning | **App** (templated from check results) | No LLM prose in evidence — every claim must cite a check and a record |
| Auth, roles, job scheduling | **App** | Standard application concerns |
| Approve / reject / override | **Human (approver role)** | Policy Step 12 — the system is advisory |

> **Core rule:** the LLM proposes *fields*, the application decides *everything else*. If the model vanishes, the deterministic pipeline still produces a REVIEW (never a false PASS) for every invoice.

---

# 2. Proposed Architecture

## Architecture diagram

```mermaid
flowchart LR
    subgraph FRONTEND["Frontend — React SPA (Vite), static on Netlify/Vercel"]
        UI["Login + Dashboard\nUpload invoice\nReview queue\nReport detail\nHistory"]
    end

    subgraph BACKEND["Backend — FastAPI on the user's VPS"]
        API["API Layer\n/auth /invoices /jobs /reports /decide"]
        AUTH["Auth & Roles\nJWT + role checks"]
        ORCH["Orchestrator\nper-invoice state machine"]
        INT["Document Intake\nPDF validate, hash, store"]
        MDS["Master Data Service\n4 CSVs, read-only lookups"]
        EXTR["Extraction Service\nregex → NVIDIA repair → vision"]
        VAL["Validation Engine\n11 deterministic checks"]
        DEC["Decision Engine\nPASS / REVIEW / BLOCK"]
        REP["Report Generator\nJSON + Markdown/HTML evidence"]
        JOBS["Job Manager\ndatabase-backed, progress tracking"]
        LOG[("Database — SQLite or MySQL\njobs, users, extractions,\nreports, decisions, audit")]
        UPL[("uploads/ on disk\nsubmitted PDFs")]
    end

    subgraph AI["AI Layer"]
        LLM["LLMClient (interface)"]
        NV["NVIDIA Provider\nOpenAI-compatible\nintegrate.api.nvidia.com/v1"]
    end

    UI -->|HTTPS / JSON| API
    API --> AUTH
    API --> JOBS
    JOBS --> ORCH
    ORCH --> INT
    ORCH --> MDS
    ORCH --> EXTR
    EXTR --> LLM --> NV
    ORCH --> VAL
    VAL --> DEC
    DEC --> REP
    INT --> UPL
    ORCH --> LOG
    REP --> LOG
    MDS -. read only .-> LOG
```

## Component-by-component rationale

| Component | What it does | Data in | Data out | Why it exists |
|---|---|---|---|---|
| **React SPA** | The single interface: login, upload, queue, report, history | User actions + API responses | API calls | The non-developer surface (finance reviewer) — no CLI required; satisfies the one-interface requirement with the best UX |
| **API Layer (FastAPI)** | REST endpoints for everything the UI does | JSON requests (JWT-authenticated) | JSON responses | Thin adapter over the pipeline so the frontend never touches PDF parsing or rules |
| **Auth & Roles** | Login, JWT issuance, role checks (reviewer / approver) | Credentials | Tokens + role decisions | Policy requires a qualified human approver; roles enforce that boundary in code |
| **Job Manager** | Creates background jobs, tracks stage progress in the database | Upload → job create | Job id + status/progress | Long reviews (>20 s with NVIDIA) must not block an HTTP request; polling a job is the simplest correct answer |
| **Orchestrator** | Runs the per-invoice state machine: intake → extract → validate → classify → report | Job + PDF path | Workflow record + report | Guarantees every invoice takes the *same* path — the repeatable-system backbone |
| **Document Intake** | Validates the uploaded PDF, hashes it, stores it | Uploaded file | Stored file + document record | Prevents malformed/duplicate inputs from entering the pipeline |
| **Master Data Service** | Loads the 4 CSVs once, validates headers, serves lookups | CSVs on VPS | Lookup results | Single choke point so lookups are consistent and malformed registries abort loudly |
| **Extraction Service** | Ladder: regex → NVIDIA text repair → NVIDIA vision | Extracted text / page images | `invoice_extraction` (schema-validated) | Concentrates all AI usage here; the rest of the system never talks to a model |
| **LLMClient** | Interface: `extract_fields(payload) → JSON` | Prompt payload | Model response (JSON) | The provider seam — NVIDIA today, anything else tomorrow |
| **Validation Engine** | Runs the 11 checks with `Decimal` math and policy tolerances | Extraction + master data | 11 check results | The auditability core; pure functions, unit-testable without a model |
| **Decision Engine** | Tier rules: critical fail → BLOCK, any fail → REVIEW, else PASS; low confidence → REVIEW | Check results | Decision + confidence + severity | Table-driven, explainable classification |
| **Report Generator** | Assembles the evidence package | Check results + master records | JSON + Markdown/HTML report | The artifact the human reads; every claim cites a check and a record |
| **Database + uploads/** | Persistent state on the VPS (SQLite or MySQL per env) | All writes | Durable records + files | Hosted app needs durable storage; VPS disk provides it (no serverless limits) |

Nothing here is a microservice. It is a modular monolith (one FastAPI process) + a static frontend — the smallest shape that can process inputs repeatedly over the web.

---

# 3. End-to-End Data Flow

## One real input (CASE-001 style, clean invoice) — Mermaid sequence

```mermaid
sequenceDiagram
    autonumber
    participant R as Reviewer (React SPA)
    participant A as FastAPI (VPS)
    participant J as Job Manager (database)
    participant P as Pipeline (orchestrator)
    participant N as NVIDIA API
    participant L as Decision Log (database)

    R->>A: POST /auth/login (email + password)
    A-->>R: JWT (role: reviewer/approver)

    R->>A: POST /invoices (multipart PDF) [Bearer]
    A->>A: validate PDF, hash, store in uploads/
    A->>J: create job (status=QUEUED)
    A-->>R: { job_id }

    R->>A: GET /jobs/{id} (poll every 2s)
    A-->>R: { status: RUNNING, stage: extracting }

    A->>J: mark RUNNING (stage: extracting)
    J->>P: run pipeline (async background task)
    P->>P: pdftotext + regex → draft extraction
    P->>N: extract/repair request (text + schema, temp 0.0)
    N-->>P: extraction JSON (fields + line items)
    P->>P: validate against schema, stamp confidence
    P->>P: 11 deterministic checks (master data read-only)
    P->>P: classify PASS / REVIEW / BLOCK
    P->>P: build evidence report (JSON + Markdown)
    P->>L: store extraction, checks, report
    A->>J: mark SUCCEEDED (stage: done)
    A-->>R: { status: SUCCEEDED, report_id }

    R->>A: GET /reports/{id}
    A-->>R: validation report (decision, 11 checks, evidence)

    R->>A: POST /decide { report_id, outcome: approved } [approver]
    A->>L: append DecisionRecord (outcome, decider, reason)
    A-->>R: { decision recorded }
```

## Operational characteristics

| Aspect | Detail |
|---|---|
| **Synchronous** | Auth, upload, report fetch, decide — all fast HTTP calls |
| **Asynchronous** | The review pipeline itself: upload returns a `job_id` immediately; the backend runs the pipeline as a background task; the UI polls `GET /jobs/{id}` every ~2 s for stage progress |
| **External API calls** | Exactly one category: NVIDIA API (extraction repair / vision). No other outbound calls exist |
| **Failure points** | Upload rejected, master data malformed, NVIDIA unavailable/timeout/invalid JSON, job crashed, poll timeout, human never decides |
| **State transitions** | Job: `QUEUED → RUNNING → SUCCEEDED/FAILED`; invoice: `RECEIVED → EXTRACTING → AI_ANALYZED → VALIDATING → CLASSIFIED → AWAITING_REVIEW → APPROVED/REJECTED → COMPLETED`, plus `BLOCKED`, `OVERRIDDEN` — see §11 |

---

# 4. Technology Stack Decisions

## Frontend — React SPA (Vite)

- **Vite + React + TypeScript**, static build deployed to **Netlify or Vercel**. Rationale: the workflow is *upload → review → decide*, which is a forms-and-tables UI; a plain SPA is the smallest thing that gives the reviewer a proper experience. No SSR needed (the app is behind login).
- **State/data:** plain `fetch` + React state (or TanStack Query if the dev prefers it) — no heavy state library for v0.
- **Styling:** any lightweight approach (e.g. plain CSS / Tailwind) — explicitly out of scope for design detail.

## Backend — FastAPI on the user's VPS

- **FastAPI + Uvicorn** behind a reverse proxy (Caddy for auto-HTTPS, or nginx + certbot) on the user's VPS. Rationale: FastAPI is the natural Python home for the existing pipeline; the VPS gives a persistent disk (database + uploads survive restarts) that serverless platforms cannot.
- Process model: one Uvicorn worker (or a couple) — the pipeline is CPU-light and the only external call is NVIDIA. No worker fleet.

## Database — SQLite or MySQL (selected via env)

- **Choice:** SQLite **or** MySQL, selected at runtime via a single `DATABASE_URL` environment variable — no code change to switch. The tables are declared once; a thin repository layer (SQLAlchemy 2.0) keeps queries and transactions identical on either engine (raw adapters would duplicate SQL and diverge on placeholder syntax).
  - `DATABASE_URL=sqlite:///invoiceops.db` — **default**; zero setup, one file; ideal for local development, single-operator use, and evaluation runs.
  - `DATABASE_URL=mysql+pymysql://user:password@host:3306/invoiceops` — the **hosted option**; MySQL runs on the VPS (or wherever the operator points it) and gives better write concurrency and standard backup tooling when the app is used by multiple people.
- Evaluated: PostgreSQL (possible, but the two chosen engines already cover both ends of the range — zero-setup local and server RDBMS — so a third engine adds nothing for v0), document DB (no schema flexibility needed — JSON is already in the contracts), vector DB (no retrieval task), and a single fixed engine (rejected — the operator wants the choice).

## AI — NVIDIA API (fixed provider, loose coupling)

```mermaid
flowchart LR
    APP["Application / Extraction Service"] -->|extract_fields payload| LLM["AI Service / LLMClient interface"]
    LLM -->|OpenAI-compatible client| NV["NVIDIA Provider"]
    NV -->|base_url https://integrate.api.nvidia.com/v1| API["NVIDIA API — NIM hosted inference"]
```

| Decision | Choice | Rationale |
|---|---|---|
| Text model | `meta/llama-3.2-11b-vision-instruct` | Live free-tier NIM VLM used for both text repair (native JSON mode) and degraded-scan vision (formerly `meta/llama-3.3-70b-instruct`, EOL 2026-08-26) |
| Vision model | `meta/llama-3.2-11b-vision-instruct` | Same model covers degraded-invoice extraction (CASE-010); schema-shaped prompt, output re-validated deterministically (formerly `qwen/qwen2.5-vl-72b-instruct`, EOL 2026-08-26) |
| Document OCR (optional) | NVIDIA Nemotron OCR v2 (NIM) | If Tesseract quality disappoints on CASE-010, Nemotron OCR is purpose-built for messy real-world documents — swapped in config, not code |
| Temperature | **0.0** | Extraction is a single-answer task; determinism and schema fidelity matter. The app generates all human-readable text, so no creativity is needed |
| Structured output | `response_format: json_object` + the extraction schema in the prompt; application re-validates output with `jsonschema` | Structured, validated AI output is a hard requirement |
| Context | System prompt (fixed; declares invoice content = data, never instructions) + invoice text or page image | Prompt-injection defense + stable behavior across runs |
| Tokens | Input ~1–3K, output ~600–900 per invoice; 12 eval cases ≈ a handful of cents/credits | Cost is a non-issue at evaluation scale; still timeboxed (see §9) |

The **LLMClient** seam (tiny, pseudocode for illustration only):

```python
class LLMClient:
    def extract_fields(self, payload: ExtractionRequest) -> ExtractionResult:
        ...  # calls self._provider (OpenAI-compatible, NVIDIA base_url)
             # returns raw JSON; NEVER a decision, NEVER free text
```

Swap provider by changing config (base URL + key + model names) — zero application changes.

## Authentication — simple login with roles (DIY for v0)

- JWT access tokens (`pyjwt`) + bcrypt password hashes; FastAPI dependencies enforce `reviewer` vs `approver` roles per endpoint.
- Rationale: policy Step 12 requires a *qualified human* approver — roles make that a code-enforced boundary. A managed auth service (Clerk/Auth0/Firebase) was evaluated and rejected for v0: it adds an external dependency, a second login UX, and cost for a two-role, two-user prototype. Documented as a future upgrade if multi-tenant deployment happens.
- Users seeded via config/seed script (no signup endpoint in v0).

## Background jobs — database job table + polling (no Redis)

- Upload → `jobs` row (QUEUED) → background task (FastAPI `asyncio`/`BackgroundTasks`) → UI polls every 2 s.
- Rationale: single VPS, single operator, ~60 s jobs, no parallelism needed. Redis/queue workers add a service and operational burden for zero v0 benefit; if concurrent load ever appears, the job store is already isolated behind the Job Manager and can move to Redis + worker without touching the pipeline.

## Other infrastructure — deliberately minimal

| Technology | Needed? | Rationale |
|---|---|---|
| Redis / queues | **No** | Database job table (SQLite/MySQL) + polling covers v0 (see above) |
| Object storage | **No** | PDFs live in `uploads/` on the VPS (persistent disk) |
| Vector database | **No** | No semantic retrieval in the workflow |
| Caching | **No** | Master data loads once per process; LLM calls are cheap |
| Logging | **Yes — stdlib `logging`** | Per-stage timings and errors to a local file; feeds evaluation metrics |
| Monitoring | **No** | Out of scope for this prototype; uptime checks optional on the VPS |
| Reverse proxy / TLS | **Yes — Caddy (or nginx + certbot)** | The app is web-hosted; HTTPS is non-negotiable for a login page |

---

# 5. Architecture Decision Record

| Decision | Choice | Alternatives Considered | Why This Choice |
|---|---|---|---|
| Backend | Python 3.11 + FastAPI (modular monolith) | Node.js, serverless functions, CLI-only | The pipeline is Python; FastAPI is the thinnest REST wrapper; serverless (e.g. Vercel functions) can't hold a persistent database or uploaded PDFs |
| Frontend | React SPA (Vite + TypeScript) | Next.js, plain HTML/CLI | User-selected; a static SPA is the smallest web UX and deploys to Netlify/Vercel as static files |
| Frontend hosting | Netlify or Vercel (static) | Self-hosting on VPS | User-selected; zero-ops static hosting for a build artifact |
| Backend hosting | User's VPS + Caddy/nginx TLS | Vercel serverless, Render, Fly.io | Persistent disk for the database + uploads; full control; user already owns it |
| Database | SQLite or MySQL via `DATABASE_URL` env (SQLAlchemy) | PostgreSQL, document, vector, single fixed engine | SQLite default for zero-setup local/eval; MySQL for the hosted VPS deployment — same schema and code, switch by env var |
| Auth | DIY JWT + bcrypt, roles (reviewer/approver) | Clerk/Auth0/Firebase | Policy needs role enforcement, not identity infrastructure; two users for v0 |
| LLM provider | NVIDIA API (NIM, OpenAI-compatible) | (fixed by requirement) | User-selected; loose coupling via LLMClient keeps it swappable |
| LLM models | `meta/llama-3.2-11b-vision-instruct` (text + vision) | Two distinct models | Single VLM covers text repair and degraded scans; account-free on NVIDIA free tier |
| Extraction | `pdftotext` + regex first; NVIDIA only for ambiguity/repair | LLM-only extraction | 11/12 eval PDFs have clean text layers — deterministic first is cheaper, faster, auditable |
| Validation | 11 deterministic checks in application code | LLM-judged checks | Thresholds come from Meridian policy; must be identical run-to-run and independent of the model |
| Job execution | Database job table + background task + polling | Redis + Celery/worker | One VPS, one operator, ~60 s jobs; simplest correct answer; isolated for later swap |
| Human approval | UI decide button (approver role); BLOCK hard stop | Auto-approve on high confidence | Policy Step 12 requires a qualified human; BLOCK must never proceed silently |
| Deployment | Frontend static (Netlify/Vercel) + backend systemd/Docker (VPS) | Full Docker Compose on VPS | Splits ops: zero-ops frontend, simple backend service; README documents both |

---

# 6. Data Contracts

All machine contracts live in `contracts/*.json` (JSON Schema, draft 2020-12). Every object the system produces **must validate** — this is enforced in code and is itself the "structured outputs" guarantee.

## 6.1 API contracts (React ↔ FastAPI)

| Endpoint | Method | Body → Response | Auth |
|---|---|---|---|
| `/auth/login` | POST | `{email, password}` → `{token, role, name}` | none |
| `/invoices` | POST | `multipart PDF` → `{invoice_id, job_id}` | reviewer+ |
| `/jobs/{id}` | GET | → `{status, stage, progress_pct, error?}` | reviewer+ |
| `/reports/{id}` | GET | → validation report (§6.4) | reviewer+ |
| `/reports/{id}/extraction` | PATCH | corrected fields → updated extraction | reviewer |
| `/decide` | POST | `{report_id, outcome, override_reason?}` → decision record | **approver** |
| `/invoices` | GET | → list (queue/history) with status | reviewer+ |

Roles: `reviewer` = submit, view, correct extraction, investigate; `approver` = everything + final approve/reject + BLOCK override. Enforced in FastAPI dependencies, not just hidden UI.

## 6.2 Input schema (what the system receives)

```jsonc
{
  "source_path": "uploads/2026-09-03/CASE-001_invoice.pdf",  // stored upload; origin: user upload
  "master_data": {                                            // config-provided paths, read-only
    "vendor_master": "…/vendor_master.csv",
    "purchase_orders": "…/purchase_orders.csv",
    "goods_receipts": "…/goods_receipts.csv",
    "processed_invoices": "…/processed_invoices.csv"
  }
}
```

| Field | Required | Origin |
|---|---|---|
| `source_path` | yes | user-provided (upload) |
| `master_data` paths | yes | configuration (secrets/config separated from code) |

## 6.3 AI input / AI output (NVIDIA boundary)

Built by the Extraction Service; **never contains** master data, decisions, or prompt instructions from the invoice.

```jsonc
// AI input
{
  "task": "extract_invoice_fields",              // fixed enum; application
  "system_prompt": "<fixed>",                    // app-owned: invoice content is DATA, never
                                                 // instructions; output only JSON matching schema
  "document": {
    "text": "Pacific Trading Company Inc\n…",    // pdftotext output (or null if none)
    "page_images": ["data:image/png;base64,…"]   // only for degraded/scanned docs (vision path)
  },
  "draft": {                                     // app's regex attempt, to repair (text path)
    "fields": { "invoice_number": {"value": "MT-2026-0847", "confidence": "high"}, … },
    "missing": ["invoice_date"]
  },
  "output_schema": { … }                         // the extraction field contract, embedded
}

// AI output — strict JSON; VALUES ONLY. The application stamps confidence/source
// deterministically (text_layer=high, ocr=medium, llm-only=medium, conflict=low).
{
  "fields": {
    "invoice_number": { "value": "MT-2026-0847" },
    "invoice_date":   { "value": "2026-08-15" },
    "vendor_name":    { "value": "Pacific Trading Company Inc" },
    "po_number":      { "value": "PO-1001" },
    "currency":       { "value": "USD" },
    "subtotal":       { "value": "32000.00" },
    "tax_rate":       { "value": "0.10" },
    "tax_amount":     { "value": "3200.00" },
    "total_amount":   { "value": "35200.00" }
  },
  "line_items": [
    { "line_no": 1, "description": "Dell PowerEdge R750 Server…",
      "quantity": "10", "unit_price": "3200.00", "tax_rate": "0.10", "amount": "32000.00" }
  ],
  "missing_fields": [],
  "extraction_notes": []
}
```

Validation: app checks (1) valid JSON, (2) matches `contracts/invoice_extraction.schema.json` shape, (3) numeric fields parse as `Decimal`, (4) no unexpected keys. One repair retry on failure; still invalid → extraction marked unreliable → REVIEW (never PASS).

## 6.4 Application output (what the rest of the system consumes)

`contracts/validation_report.schema.json` — the full report with `decision`, `confidence`, all 11 `checks` (each with status/severity/detail/evidence), `issues`, `recommendation`, `human_action_required`, and `evidence_package`. Plus `contracts/decision_log.schema.json` (human outcome) and `contracts/evaluation_result.schema.json` (evaluation scoring). See the `contracts/` directory for the complete schemas.

| Field group | Required | Generated by |
|---|---|---|
| `decision`, `confidence`, `processing_time_seconds` | yes | application (Decision Engine) |
| `checks[]` (11, incl. status/evidence) | yes | application (Validation Engine) |
| `issues[]`, `recommendation` | yes | application (templated) |
| `evidence_package` (matched vendor/PO/GRN/history) | yes | application (Master Data Service) |
| `extraction` (nested) | yes | AI proposes values; application stamps confidence/source |
| `human_action_required` | yes | application (Decision Engine) |

---

# 7. AI Responsibility vs Application Responsibility

| Responsibility | AI | Application | Human |
|---|---|---|---|
| Read the PDF / extract text | | Yes | |
| Parse fields from clean text (regex) | | Yes | |
| Repair/complete ambiguous fields | Yes | | |
| Read degraded/scanned pages (vision) | Yes | | |
| Judge whether a field is trustworthy (confidence) | | Yes | |
| Validate schema / output shape | | Yes | |
| Run the 11 validation checks (policy thresholds) | | Yes | |
| Classify PASS / REVIEW / BLOCK | | Yes | |
| Detect prompt-injection content | | Yes (deterministic patterns) | |
| Compose evidence/reasoning text | | Yes (templated) | |
| Authenticate users / enforce roles | | Yes | |
| Schedule and track jobs | | Yes | |
| Decide final approve/reject | | | Yes (approver) |
| Override a BLOCK | | | Yes (approver, documented reason) |
| Correct extracted fields before trusting them | | | Yes (reviewer, gate G1) |
| Initiate payment / contact vendor | — | — | — (never happens) |

**Principle:** the AI *proposes* (field values); the application *controls* (validates, decides, schedules, logs, transitions state); the human *authorizes* (final outcome). The model cannot change a rule, a decision, or a state.

---

# 8. Human-in-the-Loop Design

## Approval flow

```mermaid
flowchart TD
    A["AI Result — extraction"] --> B{"Schema-validated\n+ confidence stamped?"}
    B -- no --> X1["REVIEW — unreliable extraction"]
    B -- yes --> C["11 deterministic checks"]
    C --> D{"Any critical check failed?"}
    D -- yes --> E["BLOCK — hard stop"] --> E1{"Human override\nwith written reason?"}
    E1 -- no --> E2["Stays BLOCKED — escalated"]
    E1 -- yes --> E3["OVERRIDDEN"]
    D -- no --> F{"Any check failed\nor low confidence?"}
    F -- no --> G["PASS"]
    F -- yes --> H["REVIEW — evidence package"]
    G --> I["Human gate — approver decides"]
    H --> I
    I --> J{"Outcome"}
    J -- approved --> K["APPROVED → logged"]
    J -- rejected --> L["REJECTED → logged"]
```

## Per-AI-decision evaluation

| AI decision point | Automatable? | Approval needed? | Confidence threshold | Escalation rule | Low-confidence behavior |
|---|---|---|---|---|---|
| Field extraction (text path) | Yes — but any `low`/`missing` required field blocks auto-trust | G1: reviewer confirms corrected fields (PATCH endpoint) | Required fields must be `high`/`medium` | Any required field `missing` → REVIEW | REVIEW + "request replacement" (CASE-010 path) |
| Field extraction (vision path) | No — degraded docs are inherently uncertain | G1 | `medium` at best by construction | Extraction method = OCR/vision → REVIEW | REVIEW, never PASS |
| Decision classification | Yes (deterministic) | G2/G3/G4 per tier | n/a — rules, not probabilities | Critical check fail → BLOCK (escalate ≤ 1 business day, policy §8) | n/a |
| Final approve/reject | **No — always human (approver)** | Yes | n/a | BLOCK override requires written reason | Human can reject any PASS |

**Why each approval point exists:** G1 protects against garbage-in (bad fields → wrong checks); G2/G3 implement Meridian's escalation policy (§8); G4 implements policy Step 12 (qualified human makes the final decision — the system is advisory by design, documented non-goal #2).

---

# 9. Fallbacks and Failure Handling

Every failure: **Detection → Recovery → Final state.**

| Failure | Detection | Recovery / Fallback | Final state |
|---|---|---|---|
| NVIDIA API unavailable | HTTP/connect error, timeout | Extraction degrades to regex/OCR only; confidence capped at `medium`; run continues | REVIEW (never a silent PASS) |
| NVIDIA timeout (> 20 s) | Timer in LLMClient | Retry once with backoff; then mark extraction unreliable | REVIEW |
| NVIDIA rate limit (429) | Status code | Retry with exponential backoff (max 3); then degrade | REVIEW |
| Invalid AI response (non-JSON / schema-violating) | `jsonschema` validation | One repair retry (re-send with error message); then drop AI path | REVIEW + extraction issue logged |
| Upload rejected (not a PDF / empty / oversize) | Intake checks | HTTP 400 with specific message; UI shows error | No job created |
| Master data malformed/missing | Master Data Service header/row validation | Job FAILED with config error — a lookup is **never silently skipped** | FAILED (prevents false PASS) |
| Low confidence extraction | Confidence stamping | G1 human confirmation; unresolved → REVIEW | AWAITING_REVIEW |
| Missing required field (CASE-009) | Check 10 | Named in report ("invoice date absent") | REVIEW |
| Job crashed mid-pipeline | Job manager marks FAILED (with exception trace) | Job row retains trace for debugging; retry endpoint re-runs | FAILED |
| Poll timeout / browser closed | Job still runs server-side | UI reconnects to job by id; status is server truth | Continues normally |
| Database failure (SQLite or MySQL) | Connection/write error | Job FAILED with the error logged; report retained if already written | FAILED |
| Human rejection | decide → rejected | Recorded; report kept for investigation | REJECTED → COMPLETED |
| Human never decides | No transition | Report stays in queue; queue screen shows pending | AWAITING_REVIEW |

No infrastructure is added for these — they are handled in the pipeline's control flow and job manager, which is exactly the right scale for v0.

---

# 10. Privacy and Security Boundaries

## Data entering the AI (allowed to NVIDIA)

- Extracted text from the invoice (synthetic evaluation data)
- Rendered page images for degraded documents
- The app's fixed system prompt + output schema

## Data that should NOT enter the AI

| Data | Why excluded |
|---|---|
| Master data CSVs (vendor register, POs, receipts, processed history) | Not needed for extraction; keeps validation logic private to the app and prevents the model from "knowing" the expected answer |
| Decisions, check results, confidence rules | The model must not influence or be influenced by decisions |
| Passwords, tokens, API keys, config, file paths | Credentials never leave the process |
| Any real financial data (non-goal #7) | v0 processes synthetic data only; real invoices → local model or explicit consent (see below) |

## Data storage

- Stored on the **VPS**: `uploads/` (submitted PDFs), reports in `output/`, and the database — the SQLite file `invoiceops.db` by default, or the MySQL server named in `DATABASE_URL`.
- Stored in the **database (SQLite or MySQL)**: users (password hashes only), jobs, extractions, validation runs, decision records, audit events.
- Not stored: master data modifications (never written), plaintext passwords, credentials (env vars on the VPS, e.g. `NVIDIA_API_KEY`).
- Frontend (Netlify/Vercel): static files only; no data stored there.

## Access control

| Action | Who |
|---|---|
| Login | Any seeded user |
| Submit invoices, view reports, queue, history | `reviewer`, `approver` |
| Correct extracted fields (G1) | `reviewer`, `approver` |
| Final approve / reject | **`approver` only** |
| Override a BLOCK | **`approver` only** + mandatory written `override_reason` (enforced in schema) |
| Access NVIDIA key / server config | Server operator (env vars on the VPS) |
| Modify validation rules / config | Engineer (version-controlled config) |

## Auditability

Logged per run (append-only): input hash, stage timings, extraction method, LLM call result (valid/invalid/retried), all 11 check results, decision, human outcome + decider + timestamp + override reason, and all auth events (login success/failure). This makes root-cause analysis possible and satisfies policy §9 (records retention).

## Security boundaries in the architecture

1. **Prompt-injection defense:** invoice content is data, never instructions (fixed system prompt); injection patterns are also caught by deterministic regex (Check 11 → BLOCK); rules live in code, not prompts, so even a manipulated extraction cannot change a decision.
2. **HTTPS everywhere:** Caddy/nginx TLS terminates on the VPS; JWT tokens in `Authorization` headers, never in URLs.
3. **Read-only master data:** the pipeline cannot modify the registers it validates against.
4. **Append-only decision log:** no UPDATE/DELETE path in the log API.
5. **Role-gated endpoints:** approve/reject and BLOCK-override require the approver role server-side (not just hidden UI buttons).
6. **No outbound actions:** the system has no payment, email, or vendor-contact capability — by construction.
7. **CORS allowlist:** the API only accepts the configured frontend origin(s).

---

# 11. State Machine

## Invoice lifecycle

```mermaid
stateDiagram-v2
    [*] --> RECEIVED
    RECEIVED --> EXTRACTING
    EXTRACTING --> AI_ANALYZED: extraction schema-validated
    EXTRACTING --> EXTRACTION_FAILED: extraction impossible
    AI_ANALYZED --> VALIDATING
    VALIDATING --> CLASSIFIED
    CLASSIFIED --> AWAITING_REVIEW: PASS or REVIEW
    CLASSIFIED --> BLOCKED: critical check failed
    EXTRACTION_FAILED --> AWAITING_REVIEW: low confidence, human investigates
    AWAITING_REVIEW --> APPROVED: human approves (approver)
    AWAITING_REVIEW --> REJECTED: human rejects (approver)
    BLOCKED --> OVERRIDDEN: documented override (approver)
    APPROVED --> COMPLETED: decision logged
    REJECTED --> COMPLETED: decision logged
    OVERRIDDEN --> COMPLETED: decision logged
    COMPLETED --> [*]
```

## Job lifecycle (the async wrapper)

```mermaid
stateDiagram-v2
    [*] --> QUEUED
    QUEUED --> RUNNING: background task starts
    RUNNING --> SUCCEEDED: report written
    RUNNING --> FAILED: exception / config error
    SUCCEEDED --> [*]
    FAILED --> [*]
```

## Transition rules

| From | To | Valid? | Condition |
|---|---|---|---|
| RECEIVED | EXTRACTING | Yes | file validated |
| EXTRACTING | AI_ANALYZED | Yes | extraction schema-validated (with or without AI) |
| EXTRACTING | EXTRACTION_FAILED | Yes | extraction impossible (still REVIEW-able) |
| AI_ANALYZED | VALIDATING | Yes | always |
| VALIDATING | CLASSIFIED | Yes | always |
| CLASSIFIED | AWAITING_REVIEW | Yes | PASS or REVIEW |
| CLASSIFIED | BLOCKED | Yes | any critical check failed |
| AWAITING_REVIEW | APPROVED / REJECTED | Yes | approver `decide` |
| BLOCKED | OVERRIDDEN | Yes | approver override with `override_reason` |
| APPROVED / REJECTED / OVERRIDDEN | COMPLETED | Yes | decision logged |
| APPROVED / REJECTED | BLOCKED | No — invalid | decision is final once logged |
| AWAITING_REVIEW | PASS-without-human | No — invalid | final approval is never automatic (policy Step 12) |
| COMPLETED | any | No — invalid | terminal |

---

# 12. Storage Design (minimum v0 model — no SQL/migrations)

Schema is engine-agnostic: the same tables run on SQLite or MySQL depending on `DATABASE_URL` (§4). Master data stays in the CSVs; only what the system itself produces is stored.

```mermaid
erDiagram
    USER ||--o{ DECISION : "decides"
    USER ||--o{ AUDIT_EVENT : "acts"
    INVOICE ||--|| JOB : "processed by"
    INVOICE ||--|| EXTRACTION : "has"
    INVOICE ||--|| VALIDATION_RUN : "has"
    INVOICE ||--o{ AUDIT_EVENT : "emits"
    VALIDATION_RUN ||--|| DECISION : "results in"
    JOB {
        string id PK
        string status "QUEUED|RUNNING|SUCCEEDED|FAILED"
        string stage
        string error
    }
    INVOICE {
        string id PK
        string source_path
        string file_hash
        datetime received_at
        string status
    }
    EXTRACTION {
        string id PK
        string extraction_json
        string method
        string confidence
        string ai_call_id
    }
    VALIDATION_RUN {
        string id PK
        string checks_json
        string decision
        string report_json
        int processing_time_ms
    }
    DECISION {
        string id PK
        string human_outcome
        string decided_by FK
        datetime decided_at
        string override_reason
    }
    AUDIT_EVENT {
        string id PK
        datetime timestamp
        string actor
        string action
        string detail
    }
    USER {
        string id PK
        string email
        string password_hash
        string role "reviewer|approver"
    }
```

| Entity | Purpose | Important fields | Relationships | Why required |
|---|---|---|---|---|
| **User** | Login identity with role | `id`, `email`, `password_hash`, `role` | 1→n Decision, AuditEvent | Role enforcement for policy Step 12 (only approvers decide) |
| **Invoice** | One workflow item per input | `id`, `source_path`, `file_hash`, `received_at`, `status` | 1→1 Job, Extraction, ValidationRun; 1→n AuditEvent | Every repeated input gets an identity and a status — the "repeatable system" backbone |
| **Job** | Async execution wrapper | `id`, `status`, `stage`, `error` | belongs to Invoice | Lets the UI poll progress without blocking HTTP |
| **ExtractionResult** | What was extracted and how | `id`, `extraction_json`, `method`, `confidence`, `ai_call_id` | belongs to Invoice | Enables G1 (field correction) and extraction-accuracy scoring (evaluation phase) |
| **ValidationRun** | Freezes the checks that produced a decision | `id`, `checks_json`, `decision`, `report_json`, `processing_time_ms` | belongs to Invoice; 1→1 Decision | The evidence package must be reproducible after the fact |
| **DecisionRecord** | The human gate | `id`, `human_outcome`, `decided_by`, `decided_at`, `override_reason`, `notes` | belongs to ValidationRun; to User | Auditability + policy Step 12 compliance |
| **AuditEvent** | Every meaningful action | `id`, `timestamp`, `actor`, `action`, `detail` | belongs to Invoice, to User | Root-cause analysis; records retention (policy §9) |

Deliberately absent: refresh-token tables (single short-lived JWT is fine), master-data tables (CSVs are the source of truth), queue/worker tables (the job table in the chosen engine suffices), role tables (two roles are an enum, not a table).

---

# 13. Interface Design

## Screens (React SPA)

| Screen | What the user sees | Actions | API operation behind the scenes |
|---|---|---|---|
| **Login** | Email + password form | Sign in | `POST /auth/login` → JWT + role stored (localStorage/session) |
| **Dashboard / New invoice** | Drag-and-drop or file picker; recent submissions | Upload a PDF | `POST /invoices` (multipart) → job created |
| **Processing state** | Stage progress bar (extracting → validating → done) | Wait; cancel/retry on failure | `GET /jobs/{id}` polled every ~2 s |
| **Review queue** | Pending invoices (AWAITING_REVIEW / BLOCKED) with decision chips | Open a report; see age | `GET /invoices?status=…` |
| **Report detail** | Extracted fields with confidence badges, 11 checks with pass/fail status and evidence refs, issues, recommendation | Read evidence; (reviewer) correct extraction; (approver) approve/reject/override | `GET /reports/{id}`, `PATCH /reports/{id}/extraction`, `POST /decide` |
| **Extraction correction (G1)** | Fields flagged `low`/`missing` editable | Fix a value → triggers re-validation | `PATCH /reports/{id}/extraction` → rerun checks, updated decision |
| **History** | Past runs with outcome, time, decision | Filter/inspect | `GET /invoices` (paginated, status filter) |

No visual styling is specified — workflow and usability only. The primary operator path is: **login → upload → watch progress → open report → (correct if needed) → approve/reject**. BLOCK cases show a hard-stop banner and require the override reason field before the approve button enables.

---

# 14. Evaluation Strategy

Metrics selected because they map to the baseline success metrics and the dataset's `EVALUATION_RUBRIC.md`. (Confidence calibration and false-positive/false-negative rates are folded into decision accuracy + issue detection — separate rates would over-fit a 12-case sample.)

| Metric | Definition | Target (PASS gate) |
|---|---|---|
| Decision accuracy (40%) | PASS/REVIEW/BLOCK matches ground truth; CASE-010/012 accept either REVIEW or PASS *with correct reasoning* | ≥ 11/12 (≥ 92%) |
| Field extraction accuracy (30%) | Per required field: exact=1.0, close=0.7, incorrect=0.0, missing=0.0, averaged | ≥ 0.95 avg on clean cases; degraded case scored with method noted |
| Issue detection (20%) | Cases 004–012: detected=1.0, partial=0.5, missed=0.0 | ≥ 8/9 (≥ 89%) |
| Reasoning/evidence quality (10%) | strong=1.0 / adequate=0.7 / weak=0.3 / absent=0.0; judged on citations to checks + records | ≥ 0.8 avg |
| Structured-output validity | Every report validates against `contracts/` schemas; every LLM response validated | **100%** — zero invalid outputs |
| Processing time | Job wall time per invoice (pipeline portion) | ≤ 120 s avg, target ≤ 60 s on clean cases |
| Failure rate | Jobs ending FAILED / unhandled errors | 0 of 12 |
| False-safe rate | High-severity REVIEW/BLOCK cases (005/006/012) decided PASS | **0 — hard fail** |
| Human-review rate | Share of runs the human must touch (expected ~9/12 by design) | Recorded, not penalized — it is the system working as designed |

## PASS / FAIL

- **PASS (v0 acceptable):** ≥11/12 decisions correct, ≥8/9 issues detected, 0 critical failures, 100% schema-valid outputs, ≤120 s average, no unhandled failures — on the 12-case evaluation set, with baselines (manual ~170 s avg, 5/9 issues; simple-LLM to be run during evaluation) compared in the same rubric.
- **FAIL (not good enough):** any critical failure (a high-severity case passed), decision accuracy <11/12, issue detection <8/9, any structurally invalid output, or the system unable to degrade to REVIEW when NVIDIA is unavailable.

---

# 15. v0 Scope

## MUST HAVE (the smallest web system that proves the loop)

- Login with roles (reviewer / approver), seeded users
- Upload a PDF → background job → live progress in the UI
- Deterministic extraction (`pdftotext` + regex) with schema-validated output
- NVIDIA integration via LLMClient (text model; vision client wired)
- All 11 validation checks against the 4 read-only CSVs (deployed with the backend)
- PASS / REVIEW / BLOCK classification + evidence report (JSON + rendered in UI)
- Report detail screen; approve/reject for approvers; BLOCK override with mandatory reason
- Review queue + basic history
- Database (SQLite or MySQL per `DATABASE_URL`) on the VPS: users, jobs, extractions, runs, decisions, audit
- The v0 acceptance test from §16 checked into `tests/`

## SHOULD HAVE

- Extraction correction (G1) screen that re-validates after a fix
- HTML/Markdown report export (download)
- `--no-llm` offline mode proving graceful degradation (dev/eval flag)
- NVIDIA vision path exercised on CASE-010

## NOT NOW

- Multi-tenant, signup, password reset, managed auth (Clerk/Auth0)
- Redis/queue workers, object storage, vector search
- ERP integration, payment, vendor contact
- Real (non-synthetic) invoice processing
- Fine-tuning, monitoring dashboards, mobile apps
- Anything not needed to prove: **upload → extract → validate → decide → human → output**

---

# 16. v0 Demonstration

## One concrete scenario: CASE-001 (Pacific Trading, PO-1001, USD 35,200)

```text
INPUT
  Reviewer logs in (approver role), uploads invoices/CASE-001_invoice.pdf via drag-and-drop

WHAT THE SYSTEM DOES
  POST /invoices → PDF validated, hashed, stored in uploads/ → job QUEUED → background
  pipeline starts → regex extraction draft (high confidence) → since all required fields
  are present, the NVIDIA repair step is exercised anyway (proving the AI path):
  draft + instructions → meta/llama-3.2-11b-vision-instruct JSON mode

WHAT NVIDIA RECEIVES
  { task: "extract_invoice_fields", system_prompt (content-is-data),
    document: { text: "Pacific Trading Company Inc … MT-2026-0847 …" },
    draft: {…}, output_schema: {…} }

WHAT NVIDIA RETURNS
  { fields: { invoice_number: "MT-2026-0847", invoice_date: "2026-08-15",
              vendor_name: "Pacific Trading Company Inc", po_number: "PO-1001",
              currency: "USD", subtotal: "32000.00", tax_rate: "0.10",
              tax_amount: "3200.00", total_amount: "35200.00" },
    line_items: [ { qty 10 × 3200.00 = 32000.00 } ], missing_fields: [], extraction_notes: [] }

HOW THE APPLICATION VALIDATES IT
  JSON parses; matches contracts/invoice_extraction.schema.json; Decimals parse;
  app stamps confidence=high (text_layer + LLM agreement)

HOW THE DECISION IS MADE
  11/11 checks pass (vendor approved, PO open + matches, currency USD=USD,
  qty 10=10, amount ±0%, arithmetic 32000+3200=35200, GRN complete 10/10,
  no duplicate, fields complete, content clean) → PASS, confidence high

WHETHER HUMAN APPROVAL OCCURS
  Yes — the report screen shows PASS with human_action_required: approve; the approver
  clicks Approve (no auto-approval; policy Step 12)

WHAT GETS STORED
  Uploaded PDF + Job (SUCCEEDED) + Invoice + ExtractionResult + ValidationRun
  (report JSON) + DecisionRecord + AuditEvents — all in the database and uploads/ on the VPS

FINAL OUTPUT
  Report screen: decision PASS, 11 passing checks with evidence refs (vendor_master → V-002,
  purchase_orders → PO-1001, goods_receipts → GRN-2026-0451, processed_invoices → no match),
  recommendation, approve/reject buttons; queue marks the invoice COMPLETED
```

Also demonstrated: the same upload flow on CASE-006 (duplicate → BLOCK) and CASE-012 (injection → BLOCK) to show REVIEW/BLOCK branching, the hard-stop banner, and that the AI path never overrides rules.

---

# 17. Implementation Plan — DESIGN ONLY

Ordered sequence with dependencies (build begins after this design is approved):

```text
 1. Repo scaffolding + config        → monorepo: frontend/ (Vite React), backend/ (FastAPI),
                                       config/, .env.example, logging
 2. Contracts                        → contracts/*.json + jsonschema validation tests
 3. Master Data Service              → CSV loaders + lookup API + malformed-data tests
 4. Extraction (deterministic)       → pdftotext + regex parser → draft extraction
 5. LLMClient + NVIDIA integration   → provider adapter, JSON mode, retries, timeout
 6. Extraction Service (ladder)      → deterministic → NVIDIA repair → vision
 7. Validation Engine                → 11 checks, Decimal math, policy tolerances
 8. Decision + Report                → tier classification, evidence templates
 9. Pipeline orchestration           → run_invoice() pure function wired to stages
10. FastAPI API + auth + roles       → /auth /invoices /jobs /reports /decide, JWT, role deps
11. Job Manager (database + polling) → async background execution, status/stage/error
12. Database schema + repositories    → one schema on SQLite and MySQL, engine from DATABASE_URL
13. React SPA                        → login, upload, progress, report, decide, queue, history
14. Deploy: VPS backend + static     → Caddy/nginx TLS on VPS; npm run build → Netlify/Vercel
15. Evaluation harness               → 12-case runner through the API, rubric scoring, baselines
```

Dependency notes: steps 2–9 are pure functions and unit-testable without any web code; steps 10–12 make the pipeline callable over HTTP; step 13 is the first user-visible end-to-end milestone (the v0 demo); step 14 is deployment; step 15 is evaluation-phase work that reuses the same API.

---

# 18. Final Architecture Summary

## Architecture

InvoiceOps is a **React SPA (static on Netlify/Vercel) + FastAPI modular monolith on the user's VPS**. The backend runs a six-stage pipeline — intake, extraction, 11 deterministic checks, table-driven classification, evidence report, human gate — as an async background job whose progress the UI polls. AI (NVIDIA NIM: `meta/llama-3.2-11b-vision-instruct` for text repair and degraded scans) is confined to one extraction service behind a swappable `LLMClient`; it proposes fields and nothing else. All validation, decisions, scheduling, auth, and state transitions are deterministic application logic, so the system behaves identically on every invoice and degrades to REVIEW (never false PASS) when the model is unavailable. Login enforces roles (reviewer / approver), every run ends at a human decision, and every outcome is appended to the database (SQLite or MySQL) for audit and evaluation.

## Stack

```text
Frontend:   React SPA (Vite + TypeScript), static — Netlify or Vercel
Backend:    FastAPI + Uvicorn — user's VPS behind Caddy/nginx (HTTPS)
Database:   SQLite (default) or MySQL — selected via DATABASE_URL env; same schema on bothLLM:        NVIDIA API (NIM, OpenAI-compatible) — meta/llama-3.2-11b-vision-instruct
             (text JSON mode + vision, temp 0.0)
Storage:    VPS disk: uploads/ (PDFs), output/ (reports), invoiceops.db
Auth:       DIY JWT + bcrypt, roles: reviewer / approver
Jobs:       database job table (SQLite/MySQL) + FastAPI background task + UI polling (no Redis in v0)
Deployment: backend systemd/Docker on VPS; frontend static deploy to Netlify/Vercel
```

## Core data flow

```text
Upload PDF (React) → FastAPI → job (database) → extract (regex → NVIDIA repair → NVIDIA vision)
→ 11 checks (read-only master data) → classify PASS/REVIEW/BLOCK → evidence report
→ approver decides in UI → append-only log → queue/history updated
```

## Human approval

At the end of every run (policy Step 12): PASS cases get an approver approve/reject; REVIEW cases are investigated with the evidence package (reviewers can correct extraction first); BLOCK cases hard-stop and require a documented override from an approver. The system has no path to approve or pay anything.

## Main risks

1. **Regex extraction brittleness** on invoice layouts outside the 12 cases — mitigated by the NVIDIA repair/vision fallback + low-confidence → REVIEW.
2. **NVIDIA API availability/rate limits** during the demo — mitigated by `--no-llm` degradation that still produces REVIEW, and retries with backoff.
3. **CASE-010 (degraded scan)** extraction quality — mitigated by the vision model + Nemotron OCR option; acceptable outcome is REVIEW with replacement request.
4. **VPS availability / deployment friction** (TLS, DNS, CORS) — mitigated by keeping the backend a single service behind Caddy and documenting the three-step setup in the README.
5. **Evaluation overfitting** — 12 synthetic cases are a demonstration, not a statistical claim; the evaluation report must state this honestly.

## Key architectural decisions

1. **Deterministic decision core, AI only at extraction** — auditable, repeatable, cheap; the direct fix for the baseline finding (humans miss cross-document checks).
2. **NVIDIA API behind an `LLMClient` seam** — fixed provider, swappable implementation, JSON-mode structured output.
3. **React SPA + FastAPI on VPS** — the smallest web architecture with real persistence; frontend static hosting is zero-ops, the VPS holds the database + uploads.
4. **Roles enforced server-side** — policy Step 12 becomes a code boundary, not a UI convention.
5. **Background jobs via database table + polling** — async UX without adding Redis/workers; the job store is isolated so a queue can be swapped in later.
6. **Every output schema-validated** — the "repeatable system" guarantee is enforced by contracts, not by discipline.

## Success condition

This design is successful when an engineer can read this document and implement the v0 without further architectural decisions: the pipeline shape, API surface, auth model, state machine, data contracts, NVIDIA model usage, validation rules, human gates, fallbacks, and evaluation gates are all specified. The remaining build work is mechanical: create the acceptance-tested happy path (upload CASE-001 → PASS report in the UI → approver approves → logged) per §15–§16.
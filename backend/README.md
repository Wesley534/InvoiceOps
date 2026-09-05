# InvoiceOps backend

FastAPI implementation of the InvoiceOps system design (`../SYSTEM_DESIGN.md`):
upload a vendor invoice PDF, run the deterministic pipeline (intake, extraction,
11 validation checks against the master-data registers, PASS/REVIEW/BLOCK
classification, evidence report), then route the human approval gate.

**Stack:** FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2. Database is chosen
at runtime by `DATABASE_URL` (SQLite by default, MySQL supported) with one
schema and one migration set for both engines. Optional NVIDIA (OpenAI
compatible) extraction repair via the `LLMClient` seam; empty `NVIDIA_API_KEY`
runs the deterministic pipeline only.

```
InvoiceOps/
|-- backend/
|   |-- app/
|   |   |-- api/routes/      health, auth, invoices, jobs, reports, decisions,
|   |   |                    master-data CRUD
|   |   |-- core/            config (pydantic-settings), logging, security (JWT+bcrypt)
|   |   |-- db/              SQLAlchemy engine/session from DATABASE_URL
|   |   |-- models/          User, Invoice, Job, ExtractionRecord, ValidationRun,
|   |   |                    DecisionRecord, AuditEvent + Master* registers
|   |   |-- schemas/         Pydantic request/response models
|   |   `-- services/        master data, csv import, pdf tools, extraction,
|   |                        LLM client (NVIDIA), 11-check validation engine,
|   |                        decision engine, report builder, pipeline, decisions
|   |-- alembic/             migrations (run on both SQLite and MySQL)
|   |-- scripts/             evaluate_cases.py (12-case API runner)
|   |-- tests/               pytest suite using the real evaluation PDFs
|   |-- Dockerfile
|   `-- requirements.txt
|-- docker-compose.yml       API + SQLite (default)
|-- docker-compose.mysql.yml overlay that switches the API to MySQL
`-- contracts/               JSON Schema contracts (baked into the image)
```

## Quick start (local, SQLite)

Requires Python 3.11+ and `poppler-utils` (`pdftotext`) on PATH.

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # adjust DATABASE_URL / secrets as needed
.venv/bin/alembic upgrade head
.venv/bin/python -m app.initial_data        # seeds reviewer + approver users
.venv/bin/python -m app.import_master_data  # seeds the registers from MASTER_DATA_DIR
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the interactive OpenAPI UI.

Seeded users. The seed script (`python -m app.initial_data`) is idempotent: on
a fresh database it creates the two accounts below with the `SEED_*`
credentials from `.env` / the environment; existing accounts are never
overwritten on later runs. All other reviewers self-register through
`POST /auth/register`.

| Role | Email | Password (default) |
| --- | --- | --- |
| reviewer | reviewer@invoiceops.dev | ReviewerPass2026 |
| approver | approver@invoiceops.dev | ApproverPass2026 |

To provision a different approver on a fresh database, set `SEED_APPROVER_*`
in `.env` (or the container environment) before the first run. To rotate an
existing account's credentials or role later, use the approver endpoints
`PATCH /auth/users/{id}` (or delete the row and re-run the seed).

Default `DATABASE_URL` is a SQLite file under `InvoiceOps/var/invoiceops.db`.
For MySQL set `DATABASE_URL=mysql+pymysql://user:password@host:3306/invoiceops?charset=utf8mb4`
and run `alembic upgrade head` against it - no code change.

## API surface

Paths follow `SYSTEM_DESIGN.md` section 6.1 exactly.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | /health | none | liveness + database/master-data status |
| POST | /auth/login | none | returns JWT, role, name |
| POST | /auth/register | none | open self-registration; always creates a `reviewer` (never approver) |
| GET | /auth/me | reviewer+ | current user |
| GET | /auth/users | **approver** | list users (`?q=`, `?role=`, paged) |
| POST | /auth/users | **approver** | create a user with an explicit role (reviewer or approver) |
| PATCH | /auth/users/{id} | **approver** | change role / name / email, reset password, deactivate |
| POST | /invoices | reviewer+ | upload PDF; returns `{invoice_id, job_id}` |
| GET | /invoices | reviewer+ | queue/history, paginated, optional `?status=` |
| GET | /invoices/{id} | reviewer+ | invoice detail incl. extraction |
| POST | /invoices/{id}/retry | reviewer+ | re-run the pipeline for a stored PDF |
| GET | /jobs/{id} | reviewer+ | poll job: status, stage, progress_pct |
| GET | /reports/{id} | reviewer+ | validation report (contract-validated JSON) |
| GET | /reports/{id}/markdown | reviewer+ | Markdown export |
| PATCH | /reports/{id}/extraction | reviewer+ | correct extracted fields (gate G1), revalidates |
| POST | /decide | **approver** | approve/reject; BLOCK override needs `override_reason` |
| POST | /master-data/vendors | reviewer+ | add a vendor register record |
| GET | /master-data/vendors | reviewer+ | list vendors (`?q=` search, paged) |
| GET/PATCH/DELETE | /master-data/vendors/{code} | reviewer+ | read / update / delete a vendor |
| POST | /master-data/purchase-orders | reviewer+ | add a PO (with line items; totals computed) |
| GET | /master-data/purchase-orders | reviewer+ | list POs (`?q=`, `?vendor_id=`, `?status=`) |
| GET/PATCH/DELETE | /master-data/purchase-orders/{no} | reviewer+ | read / update / delete a PO |
| POST | /master-data/goods-receipts | reviewer+ | add a goods-receipt line |
| GET | /master-data/goods-receipts | reviewer+ | list receipts (`?po_number=`) |
| GET/PATCH/DELETE | /master-data/goods-receipts/{id} | reviewer+ | read / update / delete a receipt |
| POST | /master-data/processed-invoices | reviewer+ | add a processed-invoice record |
| GET | /master-data/processed-invoices | reviewer+ | list history (`?q=`, `?vendor_id=`) |
| GET/PATCH/DELETE | /master-data/processed-invoices/{id} | reviewer+ | read / update / delete a history record |

## Users and roles

- `POST /auth/register` is open to anyone (no token). The role is hard-coded
  to `reviewer` server-side, so a caller can never self-assign `approver` -
  even by smuggling a `role` field into the request body.
- The `approver` role is provisioned by the operator only: either through the
  `SEED_APPROVER_*` env credentials on the seed script's first run, or through
  the approver-only `POST /auth/users` endpoint.
- Approvers can list users, create users of either role, promote/demote
  roles, reset passwords, and deactivate accounts (`GET/POST/PATCH
  /auth/users`). An approver cannot edit their own account there.
- Every registration and user mutation is appended to `audit_events`.

Roles are enforced server-side (`reviewer` / `approver` dependencies), not just
in the UI. BLOCK overrides and final decisions are append-only rows in
`decisions`; every meaningful action is written to `audit_events`.

## Response contract

Every JSON endpoint uses a flat envelope; HTTP status codes carry the outcome.

**Success** - a `success: true` field sits at the root next to the payload.
Single-object endpoints (login, get-by-id, create, update) keep the resource
fields at the root, so writes return the stored record and clients never need
to refetch after a create/patch:

```json
{ "success": true, "vendor_id": "V-999", "legal_name": "Acme", "approved": true }
```

**Lists** - paginated collections add `count` (rows on this page), pagination
metadata and a `search` echo of the `?q=` term (null when absent):

```json
{
  "success": true,
  "count": 2,
  "search": "acme",
  "items": [{ "vendor_id": "V-001", "legal_name": "Acme", "approved": true }],
  "total": 2,
  "page": 1,
  "size": 25,
  "pages": 1
}
```

Rows inside `items` stay bare resources (no per-row envelope). List endpoints
accept `?q=` for substring search (invoices, vendors, purchase orders, goods
receipts, processed invoices, users) plus their documented filters.

**Errors** - always `{ "success": false, "error": { "code", "message",
"details"? } }`, with the same HTTP status as before:

```json
{
  "success": false,
  "error": {
    "code": "conflict",
    "message": "A vendor with code V-002 already exists."
  }
}
```

Codes map from the status: `bad_request`, `unauthorized`, `forbidden`,
`not_found`, `method_not_allowed`, `conflict`, `validation_error`,
`rate_limited`, `internal_error`, `unavailable`. Request-validation failures
(422) additionally carry `details: [{ field, message, type }]` per invalid
field. The `/reports/{id}/markdown` export is the one exception: it returns a
plain Markdown file, not JSON.

## Deterministic mode vs AI mode

- `NVIDIA_API_KEY` empty: deterministic extraction only (regex text layer).
  Clean invoices still PASS; documents that need AI help (no text layer)
  degrade to REVIEW - never a false PASS.
- `NVIDIA_API_KEY` set: the same deterministic parse runs first; the NVIDIA
  text model repairs missing/ambiguous fields and the vision model handles
  scanned documents. Output is re-validated against the extraction contract
  before it is trusted; decisions never come from the model.

## Tests and evaluation

```bash
cd backend
.venv/bin/python -m pytest tests -q                 # integration tests (16)
.venv/bin/python scripts/evaluate_cases.py          # 12-case matrix through the API
```

The pytest suite uploads real evaluation PDFs and asserts the design's
acceptance path (PASS to approval, BLOCK override with reason, G1 correction),
master-data CRUD, and user provisioning (open reviewer registration, approver
management, env-seeded credentials). `scripts/evaluate_cases.py` prints a
decision table; expected decisions come from the published rubric (the
ground-truth CSV is never read by the system).

## Docker

From the `InvoiceOps/` directory:

```bash
# API with SQLite on a named volume (http://localhost:8000)
docker compose up --build -d

# Same API backed by MySQL (adds a mysql service; host port 3307)
docker compose -f docker-compose.yml -f docker-compose.mysql.yml up --build -d

docker compose down          # stop (keeps the named volumes)
```

The container runs `alembic upgrade head`, the idempotent user seed, and the
master-data import on start. The evaluation CSVs are mounted read-only from
`../invoiceops-evaluation-dataset/master_data` (override with
`MASTER_DATA_HOST_DIR`) and are imported into the database tables - they are
not read at request time. Runtime data (uploads, sqlite file) lives on the
`invoiceops-data` volume at `/data`.

Override any setting with a root `.env` next to `docker-compose.yml` (see
`.env.example` at the repo root).

## Configuration

All settings live in `app/core/config.py` (pydantic-settings) and are read
from environment variables or `backend/.env`. Key variables:

| Variable | Default | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `sqlite:///.../var/invoiceops.db` | SQLite or MySQL - switch engines here |
| `SECRET_KEY` | dev placeholder | set a real random value in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 120 | JWT lifetime |
| `CORS_ORIGINS` | `http://localhost:5173,...` | comma-separated frontend allowlist |
| `MAX_UPLOAD_MB` | 25 | accepted PDF size |
| `MASTER_DATA_DIR` | `../invoiceops-evaluation-dataset/master_data` | used by `app.import_master_data` to seed the register tables |
| `CONTRACTS_DIR` | `contracts` | resolved against the repo root |
| `NVIDIA_API_KEY` | empty | enables AI repair/vision when set |
| `SEED_*` | `reviewer@invoiceops.dev` / `approver@invoiceops.dev` | initial users |

Paths in `MASTER_DATA_DIR`/`CONTRACTS_DIR`/`UPLOAD_DIR` are resolved relative
to the InvoiceOps project root regardless of the working directory.

For a production deployment set `APP_ENV=production` (the app then refuses to
start with the placeholder `SECRET_KEY`) and put the backend behind a TLS
terminating reverse proxy (Caddy or nginx).

## Master data registers

Master data now lives in the database (a deliberate extension of design
section 12, which originally kept the CSVs as the only source of truth):

- Tables: `master_vendors`, `master_purchase_orders` + `master_po_lines`,
  `master_goods_receipts`, `master_processed_invoices`.
- The evaluation CSVs seed these tables via `python -m app.import_master_data`
  (idempotent upsert by natural key: vendor code, PO number, GRN + PO +
  description, internal id). The importer never deletes records.
- Users (reviewer and approver roles) manage the registers through the
  `/master-data/*` endpoints; every write is written to `audit_events`.
- The pipeline queries the register tables on every run; a register that is
  empty or unseeded fails the job loudly ("Master data is incomplete...")
  instead of silently skipping a lookup. Evidence strings in reports cite the
  register (e.g. `vendor_master -> V-002`).
- Deleting a vendor that still has purchase orders is refused (409).

## Design notes

- One engine-agnostic schema: plain strings for enum columns, JSON for
  contract payloads, UUID-hex primary keys, cross-engine Alembic migrations.
- The pipeline is a modular monolith: a database-backed `jobs` row per run,
  executed by a worker thread, polled by the UI. Failures mark the job FAILED
  with the error retained for debugging.
- Extraction ladder: deterministic text-layer parse first; NVIDIA repair
  fills only missing/ambiguous fields; vision is used when there is no text
  layer. Confidence/source are stamped by the application, never the model.
- Every report validates against `contracts/validation_report.schema.json`
  before it is stored; structured-output validity is 100% by construction.

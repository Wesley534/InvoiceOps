# InvoiceOps frontend

React SPA (Vite + TypeScript) for **InvoiceOps** — AI-assisted vendor invoice
pre-approval validation. Upload a vendor invoice PDF, watch the background job
progress, and review the PASS / REVIEW / BLOCK recommendation with its evidence
package. The system is advisory only: an **approver** makes the final call
(approve / reject, or a documented override of a BLOCK).

This app talks to the FastAPI backend in `../backend`. All requests are
scaffolded in `src/lib/api.ts` (one client module — pages never build fetch
calls themselves) and the UI is assembled from reusable components in
`src/components`.

## Quick start

```bash
# 1. Start the backend first (see ../backend/README.md) — http://localhost:8000
# 2. Install and run this app
npm install
cp .env.example .env.local   # set VITE_API_URL if the backend is elsewhere
npm run dev                  # http://localhost:5173
```

Seeded accounts (see backend README):

| Role     | Email                     | Password          |
| -------- | ------------------------- | ----------------- |
| reviewer | reviewer@invoiceops.dev   | ReviewerPass2026  |
| approver | approver@invoiceops.dev   | ApproverPass2026  |

Reviewers can also self-register from the login screen (always a `reviewer`).

## What's wired

| Page              | Backend endpoints                                   |
| ----------------- | --------------------------------------------------- |
| Sign in / up      | `POST /auth/login`, `POST /auth/register`           |
| Dashboard         | `GET /invoices`, `GET /health`                      |
| New invoice       | `POST /invoices` (multipart PDF)                    |
| Processing        | `GET /jobs/{id}` (polled), `POST /invoices/{id}/retry` |
| Report            | `GET /reports/{id}`, `PATCH /reports/{id}/extraction`, `POST /decide`, `GET /reports/{id}/markdown` |
| Invoices          | `GET /invoices` (queue/history, search)             |
| Master data       | `/master-data/*` (vendors, POs, receipts, history)  |
| Settings          | `GET /health`, `GET /auth/me`                       |

## Structure

```
src/
├── lib/
│   ├── api.ts          # typed API client (single source of requests)
│   ├── types.ts        # domain types mirroring the backend contract
│   ├── constants.ts    # status labels, extraction field keys, stage map
│   ├── format.ts       # money/date formatting helpers
│   └── utils.ts        # cn() etc.
├── auth/               # session context (JWT, role, persistence)
├── components/
│   ├── ui/             # reusable primitives (Button, Card, Badge, Modal…)
│   ├── layout/         # Sidebar / Navbar / MobileNav shell
│   └── invoice/        # decision banner, checks, evidence, approval…
└── pages/              # screen-level composition only
```

`npm run typecheck` runs `tsc --noEmit`.

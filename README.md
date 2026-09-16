# CreditSea — Loan Management System

Full-stack loan management system built with **Express + TypeScript** (backend) and **Next.js + TypeScript + Tailwind CSS** (frontend). MongoDB with replica-set transactions, JWT auth, role-based access control, and a rules engine for borrower eligibility.

---

## Quick Start

```bash
# 1. Start MongoDB (single-node replica set — transactions need this)
docker compose up -d
# Wait ~10s for rs.initiate() to complete
docker compose ps   # mongo should show "healthy"

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run build
npm run seed          # creates 6 role accounts + demo borrowers at each stage
npm run dev           # http://localhost:5000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev           # http://localhost:3000
```

Open **http://localhost:3000** and sign in with any account below.

---

## Credentials

| Role         | Email                             | Password      |
|-------------|-----------------------------------|---------------|
| Admin       | admin@creditsea.com               | Password@123  |
| Sales       | sales@creditsea.com               | Password@123  |
| Sanction    | sanction@creditsea.com            | Password@123  |
| Disbursement| disbursement@creditsea.com        | Password@123  |
| Collection  | collection@creditsea.com          | Password@123  |
| Borrower    | borrower@creditsea.com            | Password@123  |

Seed also creates demo borrowers at every loan stage (REGISTERED → BRE_VERIFIED → SLIP_UPLOADED → APPLIED → SANCTIONED → DISBURSED → CLOSED) so you can test any module immediately.

---

## Demo Walkthrough

### Borrower flow (http://localhost:3000/borrower)

1. **Sign up** or log in as `borrower@creditsea.com`
2. **Onboarding** — new users see a 3-step guide (Personal Details → Upload Slip → Configure Loan)
3. **Personal Details** — enter PAN (ABCDE1234F), DOB, salary ≥ ₹25K, employment = Salaried. Live BRE hints appear as you type. Side panel shows eligibility rules.
4. **Salary Slip** — upload any PDF/JPG/PNG (≤ 5 MB). Side panel explains why it's needed.
5. **Loan Config** — drag the sliders. Side panel shows loan terms (SI formula, amount/tenure ranges).
6. **Dashboard** — summary stats (total loans, outstanding, paid, closed), active loan highlight with progress bar, expandable loan cards. Click "+ New Loan" to apply again (multiple active loans allowed).
7. **Make Payment** — for DISBURSED loans, click "Pay Now" or expand and click "Make Payment". Enter UTR, amount, and date. Loan auto-closes when fully paid.

### Ops dashboard (http://localhost:3000/dashboard)

Log in as the role you want to test. Admin sees all modules; role-specific accounts see only their module.

| Module | Role | What it does |
|--------|------|--------------|
| Leads | sales / admin | Funnel view of all borrowers + their registration stage |
| Sanction | sanction / admin | Approve or reject APPLIED loans (reject requires reason) |
| Disbursement | disbursement / admin | Record bank transfer with UTR for SANCTIONED loans |
| Collection | collection / admin | Record payments against DISBURSED loans; auto-closes when fully paid |

---

## Architecture

```
CreditSea/
├── backend/                 # Express + TypeScript
│   ├── src/
│   │   ├── config/          # env (zod), db (Mongoose lifecycle), logger (pino)
│   │   ├── models/          # Mongoose schemas: User, Loan, Payment
│   │   ├── repositories/    # Typed DB access layer (transaction-aware)
│   │   ├── services/        # Business logic (auth, BRE, loan math, dashboard)
│   │   ├── controllers/     # Thin HTTP layer (request → service → response)
│   │   ├── serializers/     # Pure response shaping (no DB access)
│   │   ├── middleware/       # JWT auth, RBAC, file upload, error handler
│   │   ├── routes/          # Express route definitions
│   │   ├── seed/            # Idempotent seed with bcrypt hashing
│   │   ├── tests/           # Unit tests: BRE, loan math, dashboard (32 green)
│   │   └── server.ts        # Express app + graceful shutdown
│   └── dist/                # Compiled JS (seed runs from here in prod)
├── frontend/                # Next.js 14 + TypeScript + Tailwind CSS
│   └── src/
│       ├── app/             # App Router pages (auth, borrower wizard, dashboard)
│       ├── components/      # Shared UI: StatusBadge, Stepper, Modal, Page helpers
│       └── lib/             # API client, auth context, types, formatters
├── docs/
│   ├── DESIGN.md            # Architecture + 12 Mermaid UML diagrams
│   ├── DECISIONS.md         # 17 ADRs with drawbacks table
│   └── API.md               # Full REST endpoint reference
└── docker-compose.yml       # MongoDB 7 replica set (auto-initiated)
```

### Backend layers

```
routes → controllers → services → repositories → models
                                       ↑
                                  serializers (response shaping)
                                  bre.ts, loanMath.ts (pure functions)
```

- **Controllers** handle HTTP only (req/res parsing, status codes)
- **Services** contain business logic (BRE evaluation, transaction orchestration)
- **Repositories** are typed, session-aware DB access (transactions pass through here)
- **Serializers** shape responses with no DB access (pure functions, independently testable)

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register borrower → returns JWT |
| POST | `/api/auth/login` | Login → returns JWT |
| GET | `/api/auth/me` | Get current user (requires JWT) |

### Borrower

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/borrower/stage` | Registration funnel stage + hasLoanConfig |
| PUT | `/api/borrower/details` | Save PAN, DOB, salary, employment (server runs BRE) |
| POST | `/api/borrower/salary-slip` | Upload salary slip (multipart) |
| PATCH | `/api/borrower/loan-config` | Save principal + tenure |
| POST | `/api/borrower/apply` | Submit loan application |
| GET | `/api/borrower/loans` | List borrower's own loans |
| POST | `/api/borrower/loans/:id/payments` | Record payment on own DISBURSED loan |

### Loans (role-gated)
| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/api/loans/:id/decide` | Sanction approve/reject (sanction / admin) |
| PATCH | `/api/loans/:id/disburse` | Record disbursement with UTR (disbursement / admin) |
| POST | `/api/loans/:id/payments` | Record payment with UTR (collection / admin) |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/sales/leads` | Sales funnel view |
| GET | `/api/dashboard/sanction/pending` | Loans awaiting decision |
| GET | `/api/dashboard/disbursement/pending` | Loans awaiting payout |
| GET | `/api/dashboard/collection/pending` | Loans with outstanding balance |
| GET | `/api/dashboard/admin/loans` | Admin: all loans with optional `?status=` filter |

Full request/response schemas: [docs/API.md](docs/API.md)

---

## Business Rules Engine

Server-authoritative (client copy is for UX hints only):

| Rule | Condition |
|------|-----------|
| AGE | 23 ≤ age ≤ 50 (DOB required) |
| SALARY | monthlySalary ≥ ₹25,000 |
| PAN | Matches `/^[A-Z]{5}[0-9]{4}[A-Z]$/` |
| EMPLOYMENT | employmentMode ≠ UNEMPLOYED |

BRE runs on `PATCH /api/borrower/personal-details`. If any rule fails, `brePassed: false` is persisted and `POST /api/borrower/apply` returns **422** with per-rule failure details.

---

## Loan Math

Fixed parameters (non-configurable):
- **Interest rate**: 12% p.a. simple interest
- **Amount range**: ₹50,000 – ₹5,00,000
- **Tenure range**: 30 – 365 days

Formulas:
```
Simple Interest = (Principal × 12 × TenureDays) / (365 × 100)
Total Repayment = Principal + Simple Interest
```

Terms are frozen at apply time and never recalculated.

---

## Status Flow

```
APPLIED → SANCTIONED → DISBURSED → CLOSED
   └→ REJECTED (reason required)
```

- **Auto-close**: When a payment brings outstanding to exactly zero, the loan is closed in the same transaction. Float safety: `Math.round(outstanding * 100) === 0` prevents floating-point dust.
- **UTR uniqueness**: Enforced by a MongoDB unique index — duplicate UTRs return 409.
- **Overpayment**: If payment amount > outstanding, the request is rejected with 400.

---

## 12-Factor Compliance

| Factor | Implementation |
|--------|---------------|
| I. Codebase | One repo, many deploys |
| II. Dependencies | `npm install` from lockfile |
| III. Config | `env.ts` zod schema — validates at startup, fails fast |
| IV. Backing services | MongoDB via `MONGO_URI` (swappable) |
| V. Build/Release | `npm run build` → `dist/` |
| VI. Processes | Stateless HTTP (sessions in JWT, not memory) |
| VII. Port binding | `HOST` + `PORT` env vars |
| VIII. Concurrency | Node cluster / multiple containers |
| IX. Disposability | Graceful shutdown (SIGTERM → drain → exit) |
| X. Dev/prod parity | Same image, `seed:dev` vs `seed:prod` |
| XI. Logs | pino structured JSON to stdout |
| XII. Admin processes | `seed` command (run once, idempotent) |

---

## Tests

```bash
cd backend
npm test          # 34 unit tests (BRE, loan math, dashboard)
bash /tmp/opencode/smoke.sh   # 35 end-to-end smoke tests

# Playwright e2e tests (requires running servers)
npx playwright test            # 18 browser tests (auth, full borrower flow, all dashboard modules)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js + Express 4 + TypeScript |
| Database | MongoDB 7 (Mongoose 8) |
| Auth | JWT (bcrypt password hashing) |
| Frontend | Next.js 14 (App Router) + React 18 |
| Styling | Tailwind CSS 3 |
| Data fetching | TanStack Query v5 |
| Notifications | react-hot-toast |
| Validation | zod (server) + zod (shared client mirrors) |
| Build | tsc (backend) + next build (frontend) |
| Logging | pino + pino-http |
| Containerization | Docker + docker compose |

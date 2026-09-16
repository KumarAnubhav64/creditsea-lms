# Design Document — CreditSea Loan Management System

Complete system design: architecture, data model, UML diagrams (ER, class, sequence, state), API contract, RBAC model, and business rules. All diagrams use [Mermaid](https://mermaid.js.org/) and render natively on GitHub.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [High-Level User Flow](#2-high-level-user-flow)
3. [Data Model — ER Diagram](#3-data-model--er-diagram)
4. [Class / Model Diagram](#4-class--model-diagram)
5. [Loan Lifecycle — State Machine](#5-loan-lifecycle--state-machine)
6. [Sequence Diagrams](#6-sequence-diagrams)
7. [RBAC Model](#7-rbac-model)
8. [Business Rule Engine (BRE)](#8-business-rule-engine-bre)
9. [Loan Mathematics](#9-loan-mathematics)
10. [Module Design — Operations Dashboard](#10-module-design--operations-dashboard)
11. [Deployment / Runtime View](#11-deployment--runtime-view)
12. [Known Drawbacks](#12-known-drawbacks)

---

## 1. System Architecture

A decoupled two-tier architecture: a Next.js SPA-style frontend talking to a stateless Express REST API over JSON + JWT. MongoDB is the only datastore; salary slips are stored on the server filesystem (see [ADR-007](DECISIONS.md#adr-007)).

```mermaid
flowchart TB
    subgraph Client["Browser"]
        subgraph BorrowerPortal["Borrower Portal (Next.js)"]
            AuthPages["Auth Pages<br/>(Login / Signup)"]
            Wizard["Application Wizard<br/>Details → Upload → Loan Config"]
            Dashboard["Borrower Dashboard<br/>Summary stats, active loan, expandable cards"]
        end
        subgraph OpsDashboard["Operations Dashboard (Next.js)"]
            Sales["Sales Module"]
            Sanction["Sanction Module"]
            Disb["Disbursement Module"]
            Coll["Collection Module"]
        end
    end

    subgraph Server["Backend (Express + TS, port 5000)"]
        MW["Middleware Chain<br/>pino-http → auth → requireRole"]
        Routes["routes/<br/>URL + middleware wiring"]
        Controllers["controllers/<br/>HTTP shape (zod) · status codes"]
        Services["services/<br/>BRE · loan math · transitions<br/>transactions · role policy"]
        Repos["repositories/<br/>the ONLY Mongoose callers"]
        Serializers["serializers/<br/>pure response shaping"]
        UploadMW["Multer Upload MW<br/>PDF/JPG/PNG ≤ 5MB"]
    end

    subgraph Data["Persistence"]
        Mongo[("MongoDB<br/>users · loans · payments<br/>one pooled connection")]
        FS[("uploads/<br/>salary slips")]
    end

    BorrowerPortal -->|HTTPS + JWT Bearer| MW
    OpsDashboard -->|HTTPS + JWT Bearer| MW
    MW --> Routes --> Controllers --> Services --> Repos --> Mongo
    Services --> Serializers
    Controllers --> UploadMW --> FS
```

**Key properties**

- **Stateless API** — every request carries a JWT; the server keeps no session state, so it scales horizontally.
- **Layered backend (ADR-015)** — strict `routes → controllers → services → repositories` dependency rule; business logic never touches Mongoose directly and is unit-testable without a database.
- **Server-authoritative business rules** — the client duplicates BRE math only for live UX feedback; the server is the single source of truth (see [ADR-003](DECISIONS.md#adr-003)).
- **Role-filtered UI, role-enforced API** — hiding a dashboard module is cosmetic; the API independently rejects unauthorized calls with `403`.

---

## 2. High-Level User Flow

```mermaid
flowchart TD
    Start([Visitor]) --> Signup[Sign Up as Borrower]
    Signup --> Login[Login]
    Login --> Portal{Role?}

    Portal -->|borrower| StageCheck{Stage?}
    StageCheck -->|REGISTERED / BRE_VERIFIED| Step1[Step 1: Personal Details]
    StageCheck -->|SLIP_UPLOADED| Step2[Step 2: Upload Salary Slip]
    StageCheck -->|READY_TO_APPLY| Step3orDash{Has loanConfig?}
    Step3orDash -->|No| Step3[Step 3: Loan Config]
    Step3orDash -->|Yes| Dashboard[Borrower Dashboard<br/>summary stats + active loan + all loans]

    Step1 --> BRECheck{Server BRE<br/>all 4 rules pass?}
    BRECheck -->|No, 422| Step1
    BRECheck -->|Yes| Step2
    Step2 --> Step3
    Step3 --> Dashboard
    Dashboard --> Apply[Apply for loan]
    Apply --> LoanApplied[Loan status: APPLIED]

    Portal -->|sales| SalesMod[Leads view:<br/>registered, not yet applied]
    Portal -->|sanction| SanctionMod[Review APPLIED loans<br/>approve / reject + reason]
    Portal -->|disbursement| DisbMod[Mark SANCTIONED loans<br/>as DISBURSED]
    Portal -->|collection| CollMod[Record payments on<br/>DISBURSED loans]
    Portal -->|admin| AllMods[All modules]

    SanctionMod --> Sanctioned[SANCTIONED] 
    SanctionMod --> Rejected[REJECTED + reason]
    DisbMod --> Disbursed[DISBURSED]
    CollMod -->|paid == total| Closed[CLOSED auto]
```

**Stage routing (GET /api/borrower/stage):** The stage endpoint returns `{ stage, hasLoanConfig }`. The frontend redirect logic:
- `REGISTERED` / `BRE_VERIFIED` → personal-details
- `SLIP_UPLOADED` → salary-slip
- `READY_TO_APPLY` + `hasLoanConfig: true` → borrower dashboard (loans page)
- `READY_TO_APPLY` + `hasLoanConfig: false` → loan-config

---

## 3. Data Model — ER Diagram

Three collections. `users` and `loans` are 1-to-many; `loans` and `payments` are 1-to-many. Payment `utr` has a **unique index** — database-level guarantee against duplicates, not just app-level validation.

```mermaid
erDiagram
    USERS ||--o{ LOANS : "borrows"
    LOANS ||--o{ PAYMENTS : "settled by"

    USERS {
        ObjectId   _id            PK
        string     name
        string     email          UK
        string     passwordHash   "bcrypt, cost 10"
        string     role           "enum: admin|sales|sanction|disbursement|collection|borrower"
        string     pan            "nullable, borrowers only"
        date       dob            "nullable"
        number     monthlySalary  "nullable"
        string     employmentMode "enum: SALARIED|SELF_EMPLOYED|UNEMPLOYED"
        boolean    brePassed      "set true only when all BRE rules pass"
        string     salarySlipUrl  "nullable, /uploads/..."
        object     loanConfig     "nullable, {amount, tenureDays} saved before apply"
        date       breCheckedAt
        date       createdAt
        date       updatedAt
    }

    LOANS {
        ObjectId   _id             PK
        ObjectId   borrower        FK "references users._id"
        number     amount          "50_000 .. 500_000 INR"
        number     tenureDays      "30 .. 365"
        number     interestRate    "fixed 12 (% p.a.)"
        number     simpleInterest
        number     totalRepayment  "amount + simpleInterest"
        number     paidAmount      "sum of accepted payments"
        string     status          "APPLIED|SANCTIONED|REJECTED|DISBURSED|CLOSED"
        string     rejectReason    "when REJECTED"
        string     salarySlipUrl   "snapshot from User at apply time"
        ObjectId   decidedBy       "sanction exec, nullable"
        ObjectId   disbursedBy     "disbursement exec, nullable"
        date       appliedAt
        date       sanctionedAt
        date       rejectedAt
        date       disbursedAt
        date       closedAt
        objectArray statusHistory   "audit: {status, by, at, note}"
        date       createdAt
        date       updatedAt
    }

    PAYMENTS {
        ObjectId   _id         PK
        ObjectId   loan        FK "references loans._id"
        string     utr         UK "unique across ALL payments"
        number     amount      "> 0, <= outstanding at record time"
        date       paymentDate
        ObjectId   recordedBy  "collection exec"
        date       createdAt
    }
```

### Design notes

- **Derived vs stored fields**: `simpleInterest` and `totalRepayment` are *stored* (not recomputed on read) so the loan terms are frozen at application time — an interest-rate change later never rewrites history. `paidAmount` is denormalized from payments and updated transactionally for cheap outstanding-balance reads.
- **`salarySlipUrl` on Loan**: Snapshotted from `user.salarySlipUrl` at apply time. The salary slip URL is immutable once the loan is applied — if the user re-uploads a slip later, existing loans keep the original reference.
- **`loanConfig` on User**: `{ amount, tenureDays }` saved via `PATCH /api/borrower/loan-config` before applying. The apply endpoint uses these saved values if no explicit amount/tenure is passed in the request body.
- **`brePassed` on User**: eligibility is a property of the *borrower*, not the loan. One successful BRE check unlocks any number of loan applications.
- **`statusHistory[]`**: embedded audit trail — every transition records who, when, and why. Avoids a separate audit collection for this assignment's scale (drawback noted in §12).

---

## 4. Class / Model Diagram

Backend code organization — models, services (pure logic), middleware, and controllers.

```mermaid
classDiagram
    direction LR

    class User {
        +String name
        +String email
        +String passwordHash
        +Role role
        +String? pan
        +Date? dob
        +Number? monthlySalary
        +EmploymentMode? employmentMode
        +Boolean brePassed
        +String? salarySlipUrl
        +comparePassword(plain) Boolean
    }

    class Loan {
        +ObjectId borrower
        +Number amount
        +Number tenureDays
        +Number interestRate
        +Number simpleInterest
        +Number totalRepayment
        +Number paidAmount
        +LoanStatus status
        +String? rejectReason
        +Array statusHistory
        +outstanding() Number
    }

    class Payment {
        +ObjectId loan
        +String utr
        +Number amount
        +Date paymentDate
        +ObjectId recordedBy
    }

    class BRESchema {
        +String fullName
        +String pan
        +Date dob
        +Number monthlySalary
        +EmploymentMode employmentMode
        +evaluate(input) BREResult
    }

    class BREResult {
        +Boolean passed
        +RuleFailure[] failures
    }

    class RuleFailure {
        +String rule
        +String message
    }

    class LoanMath {
        <<service>>
        +simpleInterest(P, R, TDays) Number
        +totalRepayment(P, si) Number
        +round2(n) Number
        +outstanding(loan) Number
    }

    class AuthService {
        <<service>>
        +register(input) AuthResult
        +login(input) AuthResult
    }

    class BorrowerService {
        <<service>>
        +updateDetails(userId, input) User
        +attachSalarySlip(userId, file) User
        +applyForLoan(userId, input) Loan
        +myLoans(userId) Loan[]
    }

    class LoanService {
        <<service>>
        +listByStatus(actor, status) Loan[]
        +getById(actor, loanId) Loan
        +decide(actorId, loanId, action, reason) Loan
        +disburse(actorId, loanId) Loan
        +recordPayment(actorId, loanId, input) Payment
    }

    class UserRepository {
        <<repository>>
        +findById(id, session?) UserDoc
        +findByEmail(email) UserDoc
        +create(data) UserDoc
        +updateProfile(id, update) UserDoc
    }

    class LoanRepository {
        <<repository>>
        +findById(id, session?) LoanDoc
        +findByStatus(status) LeanLoan[]
        +create(data) LoanDoc
        +save(loan, session?) LoanDoc
    }

    class PaymentRepository {
        <<repository>>
        +create(data, session?) PaymentDoc
        +findByLoanIds(ids) LeanPayment[]
    }

    class LoanSerializer {
        <<serializer>>
        +serializeLoan(loan, payments, borrower) DTO
        +serializeLoans(loans, payments, borrowers) DTO[]
    }

    class AuthMiddleware {
        <<middleware>>
        +verifyJWT(req, res, next)
    }

    class RBACMiddleware {
        <<middleware>>
        +requireRole(...roles)
    }

    class UploadMiddleware {
        <<middleware>>
        +salarySlipUpload (multer)
    }

    User "1" --> "0..*" Loan : borrows
    Loan "1" --> "0..*" Payment : "settled by"
    BRESchema ..> BREResult : produces
    BREResult "1" *-- "0..*" RuleFailure
    LoanMath ..> Loan : computes

    AuthService ..> UserRepository
    BorrowerService ..> LoanRepository
    BorrowerService ..> BRESchema
    LoanService ..> LoanRepository
    LoanService ..> PaymentRepository
    LoanService ..> LoanSerializer
```

**Layering rule (ADR-015)**: `routes → controllers → services → repositories → models`, nothing skips a layer. Controllers only parse HTTP shape (zod) and set status codes; services own business rules, transactions, and role policy; repositories are the ONLY Mongoose callers; serializers are pure functions. Domain logic (`bre.ts`, `loanMath.ts`) is pure and unit-tested in isolation with no database.

---

## 5. Loan Lifecycle — State Machine

Only three actor types can trigger transitions. Every other combination is rejected with `409 Conflict`.

```mermaid
stateDiagram-v2
    [*] --> APPLIED : borrower clicks Apply<br/>(BRE passed + slip uploaded)

    APPLIED --> SANCTIONED : sanction exec approves
    APPLIED --> REJECTED : sanction exec rejects<br/>(reason required)

    SANCTIONED --> DISBURSED : disbursement exec<br/>releases funds

    DISBURSED --> CLOSED : collection exec records<br/>payment, paid == total
    DISBURSED --> DISBURSED : partial payment<br/>(paid < total)

    REJECTED --> [*]
    CLOSED --> [*]

    note right of APPLIED
        Guard: borrower.brePassed == true
        AND borrower.salarySlipUrl != null
    end note

    note right of DISBURSED
        Auto-close is transactional:
        insert Payment + update Loan in
        one Mongo session; UTR unique index
        makes duplicates impossible.
        Float safety: Math.round(outstanding * 100) === 0
    end note
```

**Invalid transitions** (all → `409`): `APPLIED → DISBURSED` (skips sanction), `SANCTIONED → CLOSED` (no disbursement), `REJECTED → *` (terminal), acting on `CLOSED`, a borrower editing a loan after `APPLIED`, etc.

---

## 6. Sequence Diagrams

### 6.1 Borrower applies for a loan (happy path + BRE failure)

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (Borrower)
    participant API as Express API
    participant MW as Auth Middleware
    participant BRE as BRE Service
    participant DB as MongoDB

    Note over B: Step 1 — Login
    B->>API: POST /api/auth/login {email, password}
    API->>DB: findOne user
    API-->>B: 200 {token, user}

    Note over B: Step 2 — Personal details
    B->>API: PUT /api/borrower/details {name, pan, dob, salary, employment}
    API->>MW: verifyJWT → requireRole(borrower)
    API->>BRE: evaluate(input)
    alt any rule fails
        BRE-->>API: {passed: false, failures: [...]}
        API-->>B: 422 {failures: [{rule:"AGE", message:"..."}]}
        Note over B: Show per-rule errors,<br/>block progression
    else all rules pass
        BRE-->>API: {passed: true}
        API->>DB: update user (pan, dob, salary, brePassed=true)
        API-->>B: 200 {user with brePassed: true}
    end

    Note over B: Step 3 — Salary slip
    B->>API: POST /api/borrower/salary-slip (multipart, PDF/JPG/PNG ≤ 5MB)
    API->>DB: update user.salarySlipUrl
    API-->>B: 200 {salarySlipUrl}

    Note over B: Step 4 — Loan config
    B->>API: PATCH /api/borrower/loan-config {amount: 200000, tenureDays: 180}
    API->>DB: update user.loanConfig = {amount, tenureDays}
    API-->>B: 200 {user with loanConfig}

    Note over B: Step 5 — Apply (uses saved config)
    Note over B: Sliders compute SI live in the browser (mirror of server math)
    B->>API: POST /api/loans/apply {}
    API->>BRE: re-verify user.brePassed
    API->>DB: create Loan {status: APPLIED, salarySlipUrl snapshot, SI/total computed server-side}
    API-->>B: 201 {loan}
```

### 6.2 Sanction decision

```mermaid
sequenceDiagram
    autonumber
    participant S as Sanction Executive
    participant API as Express API
    participant DB as MongoDB

    S->>API: GET /api/loans?status=APPLIED
    API->>DB: find loans status=APPLIED (+ borrower info)
    API-->>S: 200 [loans]

    S->>API: PATCH /api/loans/:id/decision {action: "REJECT", reason: "Low salary"}
    API->>API: requireRole(sanction, admin)
    API->>API: assert loan.status == APPLIED (else 409)
    alt action == APPROVE
    API->>DB: update loan status=SANCTIONED, sanctionedAt, history
    API-->>S: 200 {loan status: SANCTIONED}
    else action == REJECT
    API->>API: assert reason present (else 400)
    API->>DB: update loan status=REJECTED, rejectReason, history
    API-->>S: 200 {loan status: REJECTED}
    end
```

### 6.3 Disbursement

```mermaid
sequenceDiagram
    autonumber
    participant D as Disbursement Executive
    participant API as Express API
    participant DB as MongoDB

    D->>API: GET /api/loans?status=SANCTIONED
    API-->>D: 200 [loans]
    D->>API: PATCH /api/loans/:id/disburse {}
    API->>API: requireRole(disbursement, admin)
    API->>API: assert loan.status == SANCTIONED (else 409)
    API->>DB: update loan status=DISBURSED, disbursedAt, disbursedBy, history
    API-->>D: 200 {loan status: DISBURSED}
```

### 6.4 Payment recording + auto-close (transactional)

```mermaid
sequenceDiagram
    autonumber
    participant C as Collection Executive
    participant API as Express API
    participant DB as MongoDB
    participant Txn as Mongo Session

    C->>API: GET /api/loans?status=DISBURSED
    API-->>C: 200 [loans with outstanding]

    C->>API: POST /api/loans/:id/payments {utr, amount, paymentDate}
    API->>API: requireRole(collection, admin)
    API->>API: assert loan.status == DISBURSED (else 409)
    API->>API: assert amount > 0 and ≤ outstanding (else 400)
    API->>Txn: startTransaction
    API->>DB: insert Payment (utr unique index → dup = 409)
    alt paidAmount + amount == totalRepayment
        API->>DB: update loan paidAmount, status=CLOSED, closedAt, history
        Note over API,C: Loan auto-closed — borrower sees CLOSED
    else
        API->>DB: update loan paidAmount
    end
    API->>Txn: commit
    API-->>C: 201 {payment, loan with outstanding}
```

---

## 7. RBAC Model

Roles: `admin`, `sales`, `sanction`, `disbursement`, `collection`, `borrower`.

### 7.1 Permission matrix

| Capability | Borrower | Sales | Sanction | Disbursement | Collection | Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Apply for loan, upload slip, own details | ✔ | | | | | |
| View own loans/payments only | ✔ | | | | | |
| View leads (registered, no loan) | | ✔ | | | | ✔ |
| List/review `APPLIED` loans | | | ✔ | | | ✔ |
| Approve / reject loans | | | ✔ | | | ✔ |
| List `SANCTIONED` loans; disburse | | | | ✔ | | ✔ |
| List `DISBURSED/CLOSED` loans; record payments | | | | | ✔ | ✔ |
| Access dashboard at all | | ✔ | ✔ | ✔ | ✔ | ✔ |

### 7.2 Enforcement flow

```mermaid
flowchart LR
    Req[Incoming request] --> JWTV{JWT valid?}
    JWTV -->|no / expired| R401[401 Unauthorized]
    JWTV -->|yes| Attach["attach req.user = {id, role}"]
    Attach --> RoleV{"requireRole(...allowed)<br/>includes role?"}
    RoleV -->|no| R403[403 Forbidden]
    RoleV -->|yes| Own{resource ownership?<br/>e.g. borrower reads own loan}
    Own -->|not owner| R403
    Own -->|ok| Handler[Controller + business rules]
    Handler -->|invalid transition| R409[409 Conflict]
    Handler -->|ok| R2xx[2xx JSON]
```

- **401** = "I don't know who you are" (missing/invalid token). **403** = "I know you, but you can't do this" (valid token, wrong role). Distinction kept deliberately (see [ADR-005](DECISIONS.md#adr-005)).
- Role is embedded in the JWT **and** re-read from the DB user document on protected routes, so a stale token after a role change is still safe.
- Frontend mirrors the matrix for UX (sidebar items, route guards) — but it is **never** trusted as the security boundary.

---

## 8. Business Rule Engine (BRE)

Pure function `evaluate(input): BREResult` — no I/O, fully unit-testable, runs on the **server**. The borrower form runs the same rules client-side for instant feedback only.

| Rule | Condition | Failure message |
|---|---|---|
| `AGE` | 23 ≤ age(dob) ≤ 50 (computed at submission) | "Applicant age must be between 23 and 50 years" |
| `SALARY` | monthlySalary ≥ ₹25,000 | "Monthly salary must be at least ₹25,000" |
| `PAN` | matches `/^[A-Z]{5}[0-9]{4}[A-Z]$/` | "PAN must follow the format ABCDE1234F" |
| `EMPLOYMENT` | employmentMode ≠ `UNEMPLOYED` | "Unemployed applicants are not eligible" |

All four must pass → `brePassed = true` is persisted on the user; the apply endpoint re-checks it server-side.

```mermaid
flowchart TD
    In[PUT /api/borrower/details] --> Validate[zod shape validation → 400]
    Validate --> R1{AGE 23..50?} & R2{SALARY ≥ 25K?} & R3{PAN regex?} & R4{not UNEMPLOYED?}
    R1 & R2 & R3 & R4 --> All{all pass?}
    All -->|yes| Save[user.brePassed = true → 200]
    All -->|no| Fail422["422 { failures: [{rule, message}] }"]
```

---

## 9. Loan Mathematics

Simple interest, fixed rate 12% p.a., tenure in days:

```
SI              = (P × R × T) / (365 × 100)     where T = tenureDays, R = 12
Total Repayment = P + SI
Outstanding     = Total Repayment − paidAmount
```

- All money values rounded to **2 decimal places** (`round2`) on both server and client, so the live slider panel always matches the stored loan to the paisa.
- Payment validation: `0 < amount ≤ outstanding` (overpayment rejected with `400`); the final payment that zeroes outstanding flips the loan to `CLOSED` in the same transaction.

---

## 10. Module Design — Operations Dashboard

### Borrower Portal

| View | Description |
|---|---|
| **Dashboard** (`/borrower/loans`) | Summary stats (total loans, outstanding, paid, closed), active loan highlight with progress bar, expandable loan cards with history, quick links to config/upload |
| **Personal Details** (`/borrower/personal-details`) | 2-column form + BRE rules sidebar. Live client-side validation mirrors server BRE |
| **Salary Slip** (`/borrower/salary-slip`) | 2-column upload zone + info sidebar. PDF/JPG/PNG ≤ 5 MB |
| **Loan Config** (`/borrower/loan-config`) | 2-column sliders + live calc panel + loan terms sidebar. Saves to `user.loanConfig` |

The stepper (Details → Slip → Config → Loans) is hidden once all steps are complete, giving the borrower a clean dashboard view. The layout uses `max-w-5xl` with tight spacing.

### Operations Dashboard

| Module | Data shown | Actions |
|---|---|---|
| **Sales** (leads) | Registered borrowers with `role=borrower` who have **no loan**: name, email, registration date, funnel stage (`REGISTERED` → `BRE_VERIFIED` → `SLIP_UPLOADED` → `READY_TO_APPLY`) | none (visibility only — lead tracking) |
| **Sanction** | `APPLIED` loans: borrower profile, amount, tenure, SI, total, slip link | Approve → `SANCTIONED`; Reject → `REJECTED` (reason required) |
| **Disbursement** | `SANCTIONED` loans awaiting fund release | Mark Disbursed → `DISBURSED` |
| **Collection** | `DISBURSED` + `CLOSED` loans: total, paid, outstanding, progress bar, payment history | Record Payment (UTR, amount, date) |

Sales funnel stage is **derived**, not stored — computed from which profile fields/loans exist, so it can never drift out of sync.

---

## 11. Deployment / Runtime View

```mermaid
flowchart LR
    subgraph Dev["Local development"]
        NPM1["npm run dev :3000<br/>Next.js (Turbopack)"]
        NPM2["npm run dev :5000<br/>tsx watch (Express)"]
        M[("MongoDB 7<br/>docker compose :27017")]
        NPM1 -->|/api proxy or CORS| NPM2
        NPM2 --> M
    end
```

- Backend: `tsx watch` for hot reload, Mongoose auto-index in dev.
- Frontend: Next.js rewrites `/api/*` to the Express server (no CORS pain in dev).
- Seed: `npm run seed` idempotently upserts role accounts + demo data.

---

## 12. Known Drawbacks

Full analysis with alternatives lives in [DECISIONS.md](DECISIONS.md#drawbacks--tradeoffs). Summary:

1. **Local filesystem for salary slips** — breaks with multiple server instances / ephemeral containers; S3 (or MinIO) is the production answer.
2. **No refresh tokens / no logout revocation** — single long-lived JWT (7d); a stolen token is valid until expiry.
3. **Monetary amounts as JS `number`** — safe at this assignment's scale (≤ ₹5L, 2dp) but floats invite rounding bugs; production would use integer paise or `decimal128`.
4. **Denormalized `paidAmount` on loans** — cheap reads, but every payment write must update it inside a transaction; an application bug writing outside the transaction could desync it.
5. **`statusHistory[]` embedded** — fine for ≤ hundreds of events; unbounded arrays are an anti-pattern at scale.
6. **No pagination** on list endpoints — fine for demo volumes; would need cursor pagination in production.
7. **No real notification system** — borrowers must poll the dashboard for status changes.
8. **Plain REST, not websockets** — executives see stale lists until refetch (mitigated with TanStack Query refocus/invalidate).

---

*Cross-references: [DECISIONS.md](DECISIONS.md) (ADRs + tradeoffs) · [API.md](API.md) (full endpoint reference) · [README.md](../README.md) (setup + credentials).*

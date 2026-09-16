# Architecture Decision Records & Trade-offs — CreditSea LMS

Every non-trivial decision made while designing this system, the alternatives considered, and the honest drawbacks we accepted. ADRs are immutable once accepted; a change means a new ADR that supersedes the old one.

---

## ADR Index

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](#adr-001) | Monorepo with `backend/` + `frontend/` | Accepted |
| [ADR-002](#adr-002) | Store role on the User document, mirror in JWT | Accepted |
| [ADR-003](#adr-003) | BRE runs server-side (client copy is UX-only) | Accepted |
| [ADR-004](#adr-004) | Dual enforcement of RBAC — frontend cosmetic, backend authoritative | Accepted |
| [ADR-005](#adr-005) | 401 vs 403 vs 409 semantics | Accepted |
| [ADR-006](#adr-006) | Frozen loan terms (SI/total stored at apply time) | Accepted |
| [ADR-007](#adr-007) | Salary slips on local filesystem via Multer | Accepted (with drawback) |
| [ADR-008](#adr-008) | Unique DB index on `payment.utr` | Accepted |
| [ADR-009](#adr-009) | `paidAmount` denormalized on Loan, updated transactionally | Accepted |
| [ADR-010](#adr-010) | Auto-close loan inside the payment transaction | Accepted |
| [ADR-011](#adr-011) | Derived (not stored) Sales funnel stage | Accepted |
| [ADR-012](#adr-012) | TanStack Query on the frontend | Accepted |
| [ADR-013](#adr-013) | `APPLIED` is a real persisted status; `REGISTERED` is derived | Accepted |
| [ADR-014](#adr-014) | No refresh tokens for this assignment | Accepted (with drawback) |
| [ADR-015](#adr-015) | Layered backend: routes → controllers → services → repositories | Accepted |
| [ADR-016](#adr-016) | Single DB lifecycle owner with explicit connection pooling | Accepted |
| [ADR-017](#adr-017) | Twelve-Factor App compliance (core hardening) | Accepted |
| [ADR-018](#adr-018) | Stage routing with `hasLoanConfig` flag | Accepted |
| [ADR-019](#adr-019) | Float-safe auto-close with `Math.round` | Accepted |
| [ADR-020](#adr-020) | Salary slip snapshot on Loan at apply time | Accepted |
| [ADR-021](#adr-021) | Borrower can record payments on own DISBURSED loans | Accepted |
| [ADR-022](#adr-022) | Multiple active loans allowed per borrower | Accepted |

---

## ADR-001 — Monorepo layout

**Context.** The assignment requires an Express backend and a Next.js frontend. Options: one repo with two packages, or two separate repos.

**Decision.** A single repo:

```
/backend   — Express + TS + Mongoose (own package.json, port 5000)
/frontend  — Next.js App Router + TS + Tailwind (own package.json, port 3000)
/docs      — DESIGN.md, DECISIONS.md, API.md
```

**Why.** One `git clone`, one README, one place for the evaluator to look. The two packages stay **independent** (no workspace tooling like turborepo/nx) — intentional, because shared code between a Node server and Next.js client is minimal here and workspaces add setup friction for reviewers.

**Drawbacks.** No enforced single version of TypeScript across packages (they drift); no shared types package — the frontend duplicates a few interfaces (`Loan`, `Payment`) by hand. At larger scale, an npm workspace with a `shared-types` package would pay off.

---

## ADR-002 — Role storage & how middleware checks it

**Context.** Six roles (`admin, sales, sanction, disbursement, collection, borrower`) need enforcement per route.

**Decision.**
- Role is a **string enum field on the User document** (`user.role`), not a separate `roles` collection — the role set is closed and small; a join would add complexity for zero flexibility.
- JWT payload = `{ sub: userId, role }`, signed HS256, 7-day expiry.
- `auth` middleware verifies the token **and loads the user from DB**; if the DB role differs from the token (e.g. admin demoted someone), the **DB wins** and the request uses the fresh role.

**Why DB re-check.** Pure stateless JWT validation would honor a stale role for up to 7 days. The extra `findOne` per request is negligible at this scale and makes role changes take effect immediately.

**Rejected alternatives.**
- *Role only in token, never re-read* — fastest, but stale-role problem.
- *Redis session store* — overkill; we'd add infra for one lookup.

**Drawback.** One DB read per authenticated request. Acceptable; would add a short-TTL cache only under real load.

---

## ADR-003 — Where does the BRE live?

**Context.** Assignment asks: "Should BRE live on the client, server, or both? Why?"

**Decision.** **Server is the single source of truth.** `breService.evaluate(input)` is a pure function that `PUT /api/borrower/details` calls; it persists `brePassed` and returns `422` with per-rule failures otherwise. The client runs an identical copy for **instant inline feedback only** (red hints under fields as the user types).

**Why both, but authoritative on the server.**
- Client-side-only rules are trivially bypassed (curl the API directly) — eligibility would be unenforceable.
- Server-side-only rules give a poor UX (submit → wait → error).
- Therefore: duplicate the *pure* rules, but the server's verdict is the only one that unlocks progression (`Apply` endpoint re-checks `user.brePassed`).

**Drawback.** Rules exist in two codebases and can drift (e.g. someone edits the client regex but not the server's). In a bigger system this would be a shared npm package consumed by both, or client would fetch rule config from the server. For this assignment the duplication is 15 lines and documented.

Also note **`brePassed` is sticky per user, evaluated at submission time** — age is checked against DOB *at the moment of detail submission*. A borrower who turns 51 a day after passing keeps `brePassed`. A production BRE would re-evaluate at apply time; we log this as a known simplification.

---

## ADR-004 — RBAC on both frontend and backend

**Context.** Assignment explicitly: "Hiding a menu item is not enough — the API must also reject unauthorized requests."

**Decision.**
- **Backend**: `requireRole('sanction', 'admin')` middleware on every route; returns `403` with `{ message }` when role doesn't match. Ownership checks (borrower sees only *their* loans) inside controllers.
- **Frontend**: sidebar renders only the current role's modules; client route guards redirect away; the UI *also* hides action buttons by status (e.g. no "Disburse" button on an `APPLIED` loan).

**Why not just backend.** Pure server enforcement with a dumb frontend leaks confusing UX (buttons that 403). Pure frontend enforcement is not security at all. Doing both is the only correct answer.

**Drawback.** Authorization logic is written twice (permission matrix in middleware + UI conditions). Drift risk is mitigated by keeping one canonical matrix table in [DESIGN.md §7.1](DESIGN.md#71-permission-matrix) and deriving both sides from it mentally; a shared policy engine (OPA/Casbin) would be the production-grade dedup.

---

## ADR-005 — HTTP status code semantics

| Code | Meaning in this system | Example |
|---|---|---|
| `400` | Malformed input, fails zod/schema validation, overpayment | `{amount: 900000}` (> ₹5L) |
| `401` | Not authenticated — missing/expired/invalid JWT | No `Authorization` header |
| `403` | Authenticated but role not permitted, or not resource owner | Sales exec calls a sanction route |
| `404` | Resource does not exist (or you're not allowed to know it) | Loan id not in DB |
| `409` | Conflicting state — duplicate UTR, invalid loan-status transition | Disbursing a `REJECTED` loan |
| `413` | Uploaded file > 5 MB | Salary slip 8 MB |
| `415` | Unsupported file type | `.txt` salary slip |
| `422` | Semantically valid shape but BRE rule failure(s) | Age 20 → `422 { failures: [...] }` |

**Why the split matters.** A 401 tells the client "get a new token"; a 403 tells it "you're logged in but this page isn't for you" (frontend routes the user to their own module); a 409 tells the executive "someone else already acted on this loan — refresh". Collapsing all three into `400/500` destroys the client's ability to react correctly.

**Note on 404-vs-403**: for cross-tenant leaks we return `404` (not `403`) when a borrower requests a loan id that isn't theirs — avoids confirming that the id exists.

---

## ADR-006 — Freeze loan terms at application time

**Context.** Interest rate is fixed at 12% p.a. *today*, but requirements change.

**Decision.** `simpleInterest` and `totalRepayment` are **computed server-side and stored on the Loan** at creation; reads never recompute.

**Why.** (a) Historical integrity — if the rate ever changes to 14%, old loans must still repay at 12%. (b) Auditability — the sanctioned document is exactly what the borrower agreed to. (c) Cheap reads — no per-request math.

**Drawback.** `paidAmount + simpleInterest + totalRepayment` can theoretically disagree if a bug writes partial updates; mitigated by computing all three in one `create()` and never updating them afterward.

---

## ADR-007 — Salary slip storage on local filesystem

**Context.** Step 3 requires a file upload (PDF/JPG/PNG ≤ 5 MB) "stored and linked to the application".

**Decision.** Multer disk storage → `backend/uploads/<uuid>.<ext>`, filename persisted as `user.salarySlipUrl`, served by Express `static('/uploads')`.

**Why not MongoDB GridFS.** Files ≤ 5 MB are within GridFS's practical range, but GridFS adds driver complexity and makes "open the file in a new tab" awkward. Local disk + static serving is the simplest correct thing for a single-server demo.

**Drawbacks (the big one).**
- **Does not survive ephemeral containers** — if the server runs in Docker/K8s without a volume, uploads vanish on redeploy. Production: S3/MinIO with pre-signed upload URLs.
- **No virus scanning** — accepting user PDFs without scanning is a real-world risk (we do validate extension + 5 MB cap only).
- **No file-content sniffing** — a renamed `.exe` claiming to be a PDF passes. `filetype`-magic-byte checks or ClamAV would harden this.
- `uploads/` is `.gitignored` — a fresh clone has no demo slips until users upload them (seed links to slips that won't exist in a fresh clone; the demo borrower's `salarySlipUrl` is seeded but the file itself isn't — acceptable because UI degrades gracefully to "not uploaded").

---

## ADR-008 — UTR uniqueness at the database level

**Context.** "UTR Number — must be unique across all payments (no duplicates)."

**Decision.** `PaymentSchema.index({ utr: 1 }, { unique: true })`. Application code catches the `E11000` duplicate-key error and maps it to `409 { message: "UTR already recorded" }`.

**Why a unique index (and not just a pre-check).** A "findOne then insert" check has a race window: two concurrent requests with the same UTR can both pass the check and both insert. The unique index is enforced by MongoDB at write time — duplicates are **impossible**, not merely unlikely. This is the difference between application-level politeness and a data integrity guarantee.

**Drawback.** The 11000 error is opaque (code, not message) and needs mapping; also the index makes UTR case-sensitive (`UTR123` ≠ `utr123`) — we normalize to uppercase before insert to avoid surprise near-duplicates.

---

## ADR-009 — Denormalized `paidAmount` on Loan

**Context.** Collection module + borrower portal both need outstanding balance = `totalRepayment − paid`.

**Decision.** Store `paidAmount` on the Loan, updated inside the payment-creation **transaction** (insert Payment + `$inc` Loan.paidAmount atomically).

**Why not aggregate payments on read** (`$sum` over payments collection). Simpler consistency, but every list view does a join/lookup — and "auto-close when paid == total" would still need the sum under concurrency. Denormalizing makes the close check a single-document comparison inside the same transaction that writes the payment.

**Drawback.** Two sources of truth (`paidAmount` vs sum of payments). If any code path ever writes a Payment without the transaction, they desync. Mitigations: the *only* write path is `POST /api/loans/:id/payments`; payments are never edited or deleted (no endpoint exists — deliberate, see below).

**Related decision — no payment edit/delete.** Real ops teams void payments rather than deleting them. We omit voiding entirely (scope), which means a mistyped amount permanently overpays... no — it *can't* overpay (validation caps at outstanding), but a wrong-too-much amount is irreversible. Documented as a simplification.

---

## ADR-010 — Auto-close inside the payment transaction

**Context.** "When total amount paid equals total repayment → loan should auto-close."

**Decision.** In the same Mongo session that inserts the Payment: `if (loan.paidAmount + amount === loan.totalRepayment) set status = CLOSED, closedAt, push history`. One atomic step — there is no window where the loan is fully paid but still `DISBURSED`, and no cron/reconciliation job needed.

**Why not a background sweeper.** A sweeper introduces lag and a failure mode (worker down → paid loans stay open → double-payment risk). Doing it inline is simpler and strictly more correct; the transaction guarantees the payment insert and the close either both happen or neither does.

**Drawback.** Exact-equality float comparison (`paidAmount + amount === total`) is only safe because we round to 2dp everywhere and cap payment at outstanding; a system with paise-level float dust would need epsilon comparison.

---

## ADR-011 — Sales funnel stage is derived, not stored

**Context.** Sales module must show "registered but haven't applied yet" with a meaningful stage.

**Decision.** Compute the stage on read:
`REGISTERED` (bare user) → `BRE_VERIFIED` (`brePassed && profile fields`) → `SLIP_UPLOADED` (`salarySlipUrl`) → `READY_TO_APPLY` (all of the above). Any user with ≥ 1 loan disappears from leads (they've converted) — though loans they hold are listed under "Converted borrowers" so sales sees outcomes.

**Why derived.** A stored `stage` field must be updated at every transition point (4 write sites) and *will* drift (e.g. a user passes BRE, then... nothing changes it back). Deriving from the same fields the other endpoints already maintain means the funnel is always consistent by construction.

**Drawback.** The "no loans yet" query is a `$lookup`/count per user — O(users × loans) without an index; fine at demo scale, would need an `hasApplied` flag or aggregation pipeline at real scale.

---

## ADR-012 — TanStack Query for server state

**Decision.** All GETs/mutations go through TanStack Query hooks (`useQuery`/`useMutation` + `queryClient.invalidateQueries`). Token via `localStorage` + a fetch wrapper injecting `Authorization`.

**Why not plain useEffect.** Caching, dedup, refetch-on-focus (executives see fresh queues when they tab back), and mutation→invalidation with zero bespoke code. It's also the industry standard, which matters for the code-quality evaluation axis.

**Drawbacks.**
- **localStorage token = XSS-stealable.** An httpOnly cookie would be safer; we accept it because it's the simplest cross-origin setup for a demo (no CSRF handling, no cookie SameSite dance). Documented, deliberate.
- One more dependency + a QueryClientProvider layer.

---

## ADR-013 — `APPLIED` persists; `REGISTERED` derives

**Context.** State-machine confusion risk: is "registered but not applied" a loan status?

**Decision.** Loan statuses are exactly `APPLIED, SANCTIONED, REJECTED, DISBURSED, CLOSED`. A user with no Loan document is in the implicit `REGISTERED` state (Sales' domain). The five persisted statuses map 1:1 to the assignment's diagram and each has a clear owner-role for its outgoing transitions.

**Why.** Storing `REGISTERED` on loans would mean creating Loan documents with no loan data — meaningless documents that every list query must exclude. A loan's lifecycle starts when it's applied for.

---

## ADR-014 — No refresh tokens

**Decision.** One 7-day access JWT, no refresh flow, no revocation list.

**Why.** Refresh tokens + rotation roughly double the auth surface (token pair storage, rotation endpoint, reuse detection). The assignment's evaluation doesn't need it; the evaluator should log in once and click around.

**Drawbacks (accepted).**
- **Logout is client-side only** — "logging out" deletes localStorage; the token itself remains valid server-side until expiry. A stolen token cannot be invalidated.
- 7 days is long for an irrevocable credential; production would pair a 15-min access token with an httpOnly refresh cookie + server-side session revocation.

---

## ADR-015 — Layered backend: routes → controllers → services → repositories

**Context.** The backend grew controllers calling Mongoose models directly. For a 3-collection API this works, but business logic and query construction were entangled, making services impossible to unit-test without a database.

**Decision.** Four strict layers:

```
routes/          → route + middleware wiring only (no logic)
controllers/     → HTTP concerns: parse/validate request shape (zod), status codes, delegate
services/        → business rules: BRE, status transitions, transactions, role policy
repositories/    → the ONLY layer that touches Mongoose models; typed find/create/save,
                   accepts an optional ClientSession so services own transactions
serializers/     → pure response shaping (no DB, no HTTP) — unit-testable presentation
models/          → schemas + hooks only
```

Dependency rule: `routes → controllers → services → repositories → models`. Nothing skips a layer; repositories never import services; controllers never import models.

**Why.**
- **Testability** — BRE/loan math/dashboard funnel are pure functions tested with zero infra (32 unit tests, no DB); services can be tested with mocked repositories.
- **Single home per concern** — "where does the Mongo query live?" and "where does the 409 get thrown?" each have exactly one answer.
- **Swap-ability** — repositories isolate Mongoose; a move to Prisma/Drizzle touches one directory.

**Deliberate pragmatism.** Services throw `ApiError` (which carries an HTTP status code) rather than pure domain errors + a separate mapper. Strictly, HTTP semantics leaking into services is impure; for this codebase the 1:1 mapping reads better than an extra translation layer. Also: the **seed script uses models directly** — it's an ops script, not a request path, and giving it service dependencies (auth checks) would be wrong.

**Drawback.** More files and indirection for a small API — `updateDetails` is 4 hops (route → controller → service → repository). For a 3-collection app this is arguably overkill; it pays off the moment a second caller (CLI job, different transport) needs the same business rules.

---

## ADR-016 — Single DB lifecycle owner with explicit connection pooling

**Context.** MongoDB connection management scattered across `server.ts` (connect) and `seed.ts` (connect/disconnect), default pool settings, no graceful shutdown of HTTP or sockets.

**Decision.** `src/config/db.ts` owns the entire lifecycle — `connect()`, `disconnect()`, `dropDatabase()`, `isHealthy()` — with an explicit pool configuration:

| Option | Dev | Prod | Rationale |
|---|---|---|---|
| `maxPoolSize` | 20 | 100 | caps concurrent sockets; sized for concurrent requests × queries-per-request + transaction headroom |
| `minPoolSize` | 1 | 5 | warm sockets avoid TCP+auth handshake latency on bursts |
| `maxIdleTimeMS` | 30s | 30s | reaps idle sockets; protects the Mongo server behind LBs |
| `serverSelectionTimeoutMS` | 5s | 5s | fail fast at boot when Mongo is down instead of hanging 30s |
| `socketTimeoutMS` | 45s | 45s | kills stuck queries |

Repositories never open connections — they ride the one process-wide pool Mongoose maintains per replica set.

**Honest note.** The Node driver already pools by default (100 sockets); for a single-process demo the numbers barely matter. The value is architectural: one owner, no connection leaks (the classic Mongoose mistake is `connect()` per request), health checks via `isHealthy()` wired into `/health`, and visible tuning knobs for production.

---

## ADR-017 — Twelve-Factor App compliance (core hardening)

**Context.** The app targets cloud-style deployment. We scored it against the [Twelve-Factor App](https://12factor.net/) and fixed everything cheap-and-valuable for this assignment's scope.

**Decision — scorecard after hardening:**

| Factor | Status | What we do |
|---|---|---|
| I Codebase | ✔ | One repo, two independently installable apps |
| II Dependencies | ✔ | Declared + lockfile; dev deps never needed at runtime |
| III Config | ✔ | zod-validated env at boot; **production fails fast** on missing/short secrets; dev defaults warn loudly; CORS origin, log level, upload cap are config |
| IV Backing services | ✔/⚠ | Mongo swapped via `MONGO_URI` alone; **uploads remain local disk** (deliberate ADR-007 deviation) |
| V Build/release/run | ✔ | `npm run build` → `dist/`; seed ships in the release (`seed:prod`) |
| VI Stateless processes | ✘/⚠ | Local uploads make the process stateful — accepted, documented, mitigated by configurable `uploadDir` |
| VII Port binding | ✔ | `PORT` env; self-contained HTTP server + `/health` |
| VIII Concurrency | ✔ | Pool tuning (ADR-016); scale = more processes behind a LB |
| IX Disposability | ✔ | SIGINT/SIGTERM → drain HTTP (`server.close`) → close pool → exit; 10s force-exit timer; `unhandledRejection` → graceful shutdown; `uncaughtException` → log-and-exit(1) |
| X Dev/prod parity | ✔/⚠ | Same Mongo version, same code path; dev uses `tsx` + pretty logs vs prod `node dist` + JSON |
| XI Logs | ✔ | pino structured JSON on **stdout only** (no files); `LOG_LEVEL` config; `pino-http` request logs; `authorization` redacted; `/health` excluded from auto-logging |
| XII Admin processes | ✔ | Seed runs identically in dev (`tsx`) and from the release artifact (`node dist/seed/seed.js`) |

**Deliberately skipped (and why):** Docker packaging (future work — would give Factor V/X their last mile); S3 uploads (ADR-007 already documents the production path); cluster-mode workers (Factor VIII satisfied at this scale); BRE thresholds as env vars (**business rules are not deployment config** — moving them to env would let a misconfigured deploy silently change lending policy).

**Drawback.** pino-pretty runs as a worker thread in dev only — a devDependency is effectively required for readable local logs; removing it just yields JSON in the terminal (still correct).

---

## ADR-018 — Stage routing with `hasLoanConfig` flag

**Context.** The frontend needs to route borrowers to the correct page based on their funnel stage. `READY_TO_APPLY` is ambiguous — the user has uploaded a slip but may or may not have configured their loan.

**Decision.** The `GET /api/borrower/stage` endpoint returns `{ stage, hasLoanConfig }`. The frontend checks both values:
- `READY_TO_APPLY` + `hasLoanConfig: true` → `/borrower/loans` (dashboard)
- `READY_TO_APPLY` + `hasLoanConfig: false` → `/borrower/loan-config`

**Why not a separate stage.** Adding a `CONFIGURED` stage would require updating `deriveStage` to check `loanConfig`, which couples the stage derivation to a field that changes frequently. The boolean flag is simpler and the frontend already knows the target page.

**Drawback.** Two response fields to inspect instead of one; if a third routing dimension appears (e.g. KYC verification), this pattern won't scale.

---

## ADR-019 — Float-safe auto-close with `Math.round`

**Context.** The auto-close check `paidAmount + amount === totalRepayment` can fail due to floating-point precision (e.g. `211835.62 - 100000 - 111835.62 = 5.684341886080802e-14` instead of `0`).

**Decision.** Both sides are rounded before comparison: `Math.round(newOutstanding * 100) === 0`. This is a 2-line fix in `computePostPayment()` in `loanMath.ts`.

**Why not integer paise.** Would require changing all money fields across the codebase. `Math.round` is a minimal, correct fix at this scale.

**Drawback.** If amounts exceed ₹9 quadrillion (16+ digits), `Number` loses precision regardless. Not a concern at this assignment's scale (≤ ₹5L).

---

## ADR-020 — Salary slip snapshot on Loan at apply time

**Context.** `user.salarySlipUrl` can change (re-upload). If the loan references the user's current URL, it would reflect a post-application upload.

**Decision.** At apply time, `user.salarySlipUrl` is copied onto the Loan document as `loan.salarySlipUrl`. The Loan's copy is immutable — if the user re-uploads a slip, existing loans keep the original reference.

**Why.** Audit integrity — the sanction team reviews the slip that was on file when the loan was applied. Changing it post-hoc would be confusing and potentially fraudulent.

**Drawback.** If a user re-uploads a slip to fix an error, the old (wrong) slip stays on old loans. Production would version-file in S3 with references.

---

## ADR-021 — Borrower can record payments on own DISBURSED loans

**Context.** Previously only collection executives could record payments. Borrowers had no way to make payments themselves.

**Decision.** Added `POST /borrower/loans/:id/payments` — same transactional logic as the collection endpoint, but with ownership check (borrower must own the loan). UTR uniqueness, outstanding validation, and auto-close all apply.

**Why.** A borrower portal without self-service payments is incomplete. The collection module is for executive-initiated recording; borrowers should be able to pay directly.

**Drawback.** Same UTR namespace — a borrower and collection exec cannot use the same UTR (which is correct — UTRs are unique per transaction).

---

## ADR-022 — Multiple active loans allowed per borrower

**Context.** The original design restricted borrowers to one active loan at a time (the `canApply` check).

**Decision.** Removed the frontend restriction. Borrowers can apply for multiple loans simultaneously. The backend has no restriction either — each loan is independent.

**Why.** Real lending platforms allow multiple concurrent loans (different purposes, different tenures). The assignment doesn't specify a restriction.

**Drawback.** No aggregate debt-to-income check — a borrower could theoretically over-extend. Production would add a global credit limit check at apply time.

---

## Drawbacks & Trade-offs — Consolidated List

| # | Area | Drawback | Production fix |
|---|---|---|---|
| 1 | File storage | Local filesystem; lost on container redeploy; no AV scan; extension-only validation | S3 + pre-signed URLs; ClamAV; magic-byte sniffing |
| 2 | Auth | No refresh/revocation; logout doesn't kill server-side token; token in localStorage (XSS) | Short access + httpOnly refresh cookie; session store |
| 3 | Money | `number` (float) for INR amounts; exact-equality close check | Integer paise or `Decimal128`; epsilon compares |
| 4 | Consistency | `paidAmount` denormalized — desync possible if any non-transactional write path appears | Single write path (enforced); reconciliation job |
| 5 | Scale | No pagination/sorting on list APIs; funnel query does per-user lookups | Cursor pagination + aggregation pipeline |
| 6 | Audit | `statusHistory[]` embedded, unbounded | Capped event collection / append-only audit log |
| 7 | Realtime | Polling only (refetch on focus); no webhooks/SSE for status changes | SSE or websocket loan-status feed |
| 8 | BRE | Rules duplicated client/server; `brePassed` sticky (age checked once, not per-apply) | Shared rules package; re-evaluate at apply time |
| 9 | RBAC | Permission matrix maintained in two places (middleware + UI) | Shared policy module / Casbin |
| 10 | Types | No shared types package between backend & frontend — manual duplication of `Loan`/`Payment` shapes | npm workspace `@creditsea/shared` |
| 11 | Testing | Unit tests cover pure logic (BRE/math/close) + smoke suite + Playwright e2e (18 browser tests) | Performance/load testing; visual regression testing |
| 12 | Ops | No rate limiting on auth endpoints (brute-force possible); no helmet/CSP hardening beyond basics | express-rate-limit, helmet CSP, lockout |
| 13 | 12-Factor | Stateful local uploads violate Factor VI; no container artifact (Factor V/X last mile) | S3-backed uploads; multi-stage Dockerfile |
| 14 | Lending | No aggregate credit limit check — borrower can have unlimited concurrent loans | Global DTI check at apply time; credit bureau integration |

---

*See also: [DESIGN.md](DESIGN.md) (diagrams + data model) · [API.md](API.md) (endpoint reference) · [README.md](../README.md) (setup).*

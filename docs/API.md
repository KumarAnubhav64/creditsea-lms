# API Reference — CreditSea LMS

Base URL: `http://localhost:5000/api` · All bodies & responses are JSON unless `multipart/form-data` is noted.
Auth: `Authorization: Bearer <jwt>` on every route except `register`/`login`.

Status-code semantics: `400` bad input · `401` unauthenticated · `403` wrong role/not owner · `404` not found · `409` state conflict (duplicate UTR, invalid status transition) · `413` file too large · `415` bad file type · `422` BRE failure.

---

## Auth

### `POST /auth/register`
Public. Creates a **borrower** account (executive roles are seed/script-only).

```jsonc
// request
{ "name": "Ravi Kumar", "email": "ravi@example.com", "password": "Secret@123" }
// 201
{ "token": "...", "user": { "id": "...", "name": "Ravi Kumar", "email": "ravi@example.com", "role": "borrower", "brePassed": false } }
// 400 (weak password / bad email) · 409 (email already registered)
```

### `POST /auth/login`
Public.

```jsonc
// request
{ "email": "sanction@creditsea.com", "password": "Password@123" }
// 200
{ "token": "...", "user": { "id": "...", "role": "sanction", "name": "Sanjay Sanction" } }
// 401 (invalid credentials)
```

### `GET /auth/me`
Any authenticated role. Returns fresh user (profile fields for borrowers).

```jsonc
// 200
{ "user": { "id": "...", "role": "borrower", "brePassed": true, "pan": "ABCDE1234F", "salarySlipUrl": "/uploads/x.pdf", "monthlySalary": 42000, "employmentMode": "SALARIED", "dob": "1996-04-12T00:00:00.000Z", "name": "Ravi Kumar", "email": "ravi@example.com" } }
```

---

## Borrower portal

### `GET /borrower/stage`
Role: `borrower`. Returns the current funnel stage + whether a loan config exists.

```jsonc
// 200
{ "stage": "READY_TO_APPLY", "hasLoanConfig": true }
// stage ∈ REGISTERED | BRE_VERIFIED | SLIP_UPLOADED | READY_TO_APPLY
// hasLoanConfig: true if user has saved amount + tenure via loan-config
```

### `PUT /borrower/details`
Role: `borrower`. Runs the **BRE** server-side.

```jsonc
// request
{ "name": "Ravi Kumar", "pan": "ABCDE1234F", "dob": "1996-04-12", "monthlySalary": 42000, "employmentMode": "SALARIED" }
// employmentMode ∈ SALARIED | SELF_EMPLOYED | UNEMPLOYED

// 200 (all rules passed — user.brePassed set true)
{ "user": { /* full profile, brePassed: true */ } }

// 422 (BRE failed — application blocked)
{ "message": "Business rules failed",
  "failures": [ { "rule": "AGE", "message": "Age must be between 23 and 50 years" },
                { "rule": "SALARY", "message": "Monthly salary must be at least ₹25,000" } ] }
// 400 (invalid PAN shape / non-numeric salary — zod)
```

### `POST /borrower/salary-slip`
Role: `borrower`. `multipart/form-data`, field name `file`. PDF/JPG/PNG, ≤ 5 MB.

```jsonc
// 200
{ "user": { "salarySlipUrl": "/uploads/1a2b3c4d.pdf", /* ... */ } }
// 413 > 5MB · 415 wrong type · 400 no file
```

### `PATCH /borrower/loan-config`
Role: `borrower`. Saves principal + tenure before applying. The apply endpoint uses these values if no explicit amount/tenure is passed in the body.

```jsonc
// request
{ "amount": 200000, "tenureDays": 180 }

// 200
{ "user": { "loanConfig": { "amount": 200000, "tenureDays": 180 }, /* ... */ } }
// 400 (out-of-range amount/tenure)
```

### `POST /loans/apply`
Role: `borrower`. Requires `brePassed === true` **and** a salary slip on file (else `409`). If `amount`/`tenureDays` not provided, uses saved `user.loanConfig`.

```jsonc
// request
{ "amount": 200000, "tenureDays": 180 }
// constraints: 50_000 ≤ amount ≤ 500_000, 30 ≤ tenureDays ≤ 365

// 201 (SI & total computed server-side, status APPLIED)
{ "loan": { "id": "...", "amount": 200000, "tenureDays": 180, "interestRate": 12,
            "simpleInterest": 11835.62, "totalRepayment": 211835.62,
            "paidAmount": 0, "status": "APPLIED", "appliedAt": "...",
            "statusHistory": [ { "status": "APPLIED", "at": "...", "by": "...", "note": "Loan application submitted" } ] } }
// 400 (out-of-range amount/tenure) · 409 (BRE not passed / no slip)
```

### `GET /borrower/loans`
Role: `borrower`. Own loans only, newest first, each with payments + outstanding.

```jsonc
// 200
{ "loans": [ { "id": "...", "amount": 200000, "status": "DISBURSED",
               "totalRepayment": 211835.62, "paidAmount": 50000,
               "outstanding": 161835.62, "payments": [ { "utr": "UTR123", "amount": 50000, "paymentDate": "..." } ] } ] }
```

### `POST /borrower/loans/:id/payments`
Role: `borrower`. Record a payment on own DISBURSED loan. Same rules as collection endpoint: UTR unique, amount ≤ outstanding.

```jsonc
// request
{ "utr": "UTR20260116001", "amount": 50000, "paymentDate": "2026-09-16" }

// 201 (partial)
{ "payment": { "id": "...", "utr": "UTR20260116001", "amount": 50000 },
  "loan": { "status": "DISBURSED", "paidAmount": 50000, "outstanding": 161835.62 } }

// 201 (final → auto-close)
{ "payment": { /* ... */ },
  "loan": { "status": "CLOSED", "paidAmount": 211835.62, "outstanding": 0 } }

// 400 (amount > outstanding) · 404 · 409 (duplicate UTR / not DISBURSED / not your loan)
```

---

## Operations dashboard

### `GET /dashboard/sales/leads`
Role: `sales`, `admin`. Registered borrowers with **no loan**, plus funnel stage.

```jsonc
// 200
{ "leads": [ { "id": "...", "name": "Ravi Kumar", "email": "ravi@example.com", "createdAt": "...",
               "stage": "SLIP_UPLOADED" } ],   // REGISTERED | BRE_VERIFIED | SLIP_UPLOADED | READY_TO_APPLY
  "converted": [ { "id": "...", "name": "Meera Patel", "loanCount": 1, "latestStatus": "DISBURSED" } ] }
```

### `GET /loans?status=APPLIED|SANCTIONED|DISBURSED|CLOSED|REJECTED`
Role-scoped: `sanction` may query `APPLIED|REJECTED`; `disbursement` → `SANCTIONED`; `collection` → `DISBURSED|CLOSED`; `admin` → any. Borrowers use `/borrower/loans` instead. Embedded borrower summary on each loan.

```jsonc
// 200
{ "loans": [ { "id": "...", "amount": 200000, "tenureDays": 180, "simpleInterest": 11835.62,
               "totalRepayment": 211835.62, "paidAmount": 0, "outstanding": 211835.62,
               "status": "APPLIED", "appliedAt": "...",
               "borrower": { "id": "...", "name": "Ravi Kumar", "email": "ravi@example.com",
                             "monthlySalary": 42000, "employmentMode": "SALARIED", "salarySlipUrl": "/uploads/x.pdf" },
               "payments": [ /* collection module */ ] } ] }
// 403 (role querying a status outside its module)
```

### `PATCH /loans/:id/decision`
Role: `sanction`, `admin`. Loan must be `APPLIED` (else `409`).

```jsonc
// request — approve
{ "action": "APPROVE" }                       // → status SANCTIONED
// request — reject (reason REQUIRED)
{ "action": "REJECT", "reason": "Debt-to-income too high" }   // → status REJECTED

// 200
{ "loan": { "status": "SANCTIONED", "sanctionedAt": "...", "statusHistory": [ /* appended */ ] } }
// 400 (REJECT without reason) · 404 · 409 (loan not APPLIED)
```

### `PATCH /loans/:id/disburse`
Role: `disbursement`, `admin`. Loan must be `SANCTIONED` (else `409`).

```jsonc
// 200
{ "loan": { "status": "DISBURSED", "disbursedAt": "...", "disbursedBy": "<exec id>" } }
// 404 · 409 (not SANCTIONED)
```

### `POST /loans/:id/payments`
Role: `collection`, `admin`. Loan must be `DISBURSED` (else `409`).

```jsonc
// request
{ "utr": "UTR20260116001", "amount": 50000, "paymentDate": "2026-09-16" }
// rules: UTR unique system-wide (dup → 409); 0 < amount ≤ outstanding (else 400)

// 201 (partial payment)
{ "payment": { "id": "...", "utr": "UTR20260116001", "amount": 50000, "paymentDate": "...", "recordedBy": "..." },
  "loan": { "status": "DISBURSED", "paidAmount": 50000, "outstanding": 161835.62 } }

// 201 (final payment → auto-close)
{ "payment": { /* ... */ },
  "loan": { "status": "CLOSED", "paidAmount": 211835.62, "outstanding": 0, "closedAt": "..." } }

// 400 (amount > outstanding or ≤ 0) · 404 · 409 (duplicate UTR / loan not DISBURSED)
```

### `GET /loans/:id`
Role-aware detail: executives (sanction/disbursement/collection/admin) may view any loan; borrowers only their own (`404` otherwise).

---

## Error envelope

Every error response:

```jsonc
{ "message": "UTR already recorded", "failures": [ /* only on 422 BRE */ ] }
```

---

## Loan lifecycle recap

```
APPLIED ──(sanction approves)──► SANCTIONED ──(disbursement releases)──► DISBURSED ──(final payment)──► CLOSED
   └──(sanction rejects + reason)──► REJECTED ✝
```

Every transition is restricted by role **and** current status; `statusHistory[]` records `{status, by, at, note}` on each hop.

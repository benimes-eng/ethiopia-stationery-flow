# Application Security & Hardening Architecture

## 1. Threat Model & Defense-in-Depth

The Abay Stationery platform implements defense-in-depth across the network, application, and database tiers.

---

## 2. Key Security Mitigations

### 2.1 SQL Injection Prevention
All database queries utilize parameterized queries and typed expressions via **Drizzle ORM**. Raw concatenated SQL strings are strictly prohibited.

### 2.2 Broken Authentication Mitigations
- Passwords hashed using memory-hard **Argon2id** (64MB memory cost).
- Rate-limiting middleware (`@fastify/rate-limit`) limits failed attempts on `/api/v1/auth/login`.
- Accounts lock for 15 minutes after 5 consecutive failed attempts.
- Tokens rotate on refresh; sessions are revocable in the `sessions` table.

### 2.3 Broken Access Control
- Every route verifies authentication (`authenticate`) and role permissions (`requirePermission`).
- Branch-level scoping verifies cashiers only ring transactions in their assigned store.
- Database enforces PostgreSQL Row-Level Security (RLS) as a secondary boundary.

### 2.4 Error Masking & Information Leakage Prevention
The centralized error handler masks internal exceptions:
- Database connection errors, SQL syntax errors, and stack traces are logged securely to server logs via Pino but **never** returned to the browser client.
- Clients receive structured, generic errors (e.g. `{ error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." } }`).

### 2.5 Security Headers
Configured via `@fastify/helmet`:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Referrer-Policy: strict-origin-when-cross-origin`

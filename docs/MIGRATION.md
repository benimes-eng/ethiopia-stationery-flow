# Phased Migration Strategy: Prototype to Production

## 1. Overview

This guide details how to transition from the initial frontend prototype with local storage into a fully live, multi-tenant production environment with zero business disruption.

---

## 2. Phased Rollout Sequence

### Step 1: Database Provisioning & Schema Initialization
1. Deploy PostgreSQL 16 instance.
2. Run database initialization (`backend/src/db/init.sql`).
3. Apply Drizzle migrations (`npm run db:migrate` inside `backend/`).
4. Execute seed script (`npm run db:seed` inside `backend/`) to establish baseline administrative users and tax rules.

### Step 2: Backend API Service Verification
1. Start the Fastify backend server on port 4000.
2. Validate health checks:
   ```bash
   curl http://localhost:4000/health
   curl http://localhost:4000/ready
   ```
3. Test login endpoint with seeded credentials (`owner@example.com` / `password123`) to ensure JWT generation and Argon2id verification succeed.

### Step 3: Frontend Dual-Mode Integration
The frontend architecture supports dual-mode operation:
- **Demo / Standalone Mode (`VITE_USE_API=false`)**: Uses the stateful in-memory repository with `localStorage` persistence, ideal for offline demos and isolated testing.
- **Production API Mode (`VITE_USE_API=true`)**: Routes all service operations through `apiClient` (`src/repositories/api-client.ts`), communicating directly with the Fastify backend and PostgreSQL.

### Step 4: Cutover & Data Verification
1. Import existing master catalog CSV (`products.tsx`) into PostgreSQL.
2. Verify initial branch stock balances via the Inventory Center (`/inventory`).
3. Conduct test checkouts on the POS counter (`/pos`), confirming that:
   - Receipts print with valid consecutive sequence numbers.
   - Stock balances decrement atomically.
   - Payments and invoices reflect accurately in financial reports.
4. Disable demo reset functionality (`ENABLE_DEMO_RESET=false`).

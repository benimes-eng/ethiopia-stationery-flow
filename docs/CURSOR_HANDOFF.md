# Abay Stationery SaaS — Cursor Engineer Handoff Guide

## 1. Executive Summary

This codebase is a production-grade multi-tenant SaaS frontend foundation built for medium-to-large stationery and office supply enterprises in Ethiopia. It covers multi-branch retail POS, warehouse stock management, B2B wholesale quotation/invoicing, supplier purchasing, operating expense tracking, and Ethiopian tax (15% VAT / 2% TOT) compliance.

Every user screen, modal, table, filter, and document workflow is built and wired to an in-memory repository and service layer. A backend engineer using Cursor can step in and replace the repository/service layer with real REST/GraphQL APIs and a PostgreSQL database without having to redesign or refactor the frontend screens.

---

## 2. Technology Stack

- **Framework**: TanStack Start / TanStack Router (file-based routing under `src/routes/`)
- **Language**: TypeScript (strict mode)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **State Management**:
  - Server Cache: TanStack React Query v5
  - Client / POS Session: Zustand (`src/stores/pos-store.ts`, `src/stores/session-store.ts`)
- **Forms & Validation**: React Hook Form + Zod resolvers
- **Charts & Visualization**: Recharts
- **Icons**: Lucide React
- **Notifications**: Sonner

---

## 3. Directory Structure

```
src/
├── components/
│   ├── app/                    # Reusable application-level domain components
│   │   ├── app-layout.tsx      # Page wrapper with RBAC permission guard
│   │   ├── app-shell.tsx       # Sidebar, branch switcher, header, notifications
│   │   ├── data-table.tsx      # Paginated, sortable, filterable table
│   │   ├── document-preview.tsx# Printable 80mm thermal receipt & A4 Invoice/Quotation
│   │   ├── navigation.ts       # Central navigation registry with permission gates
│   │   ├── primitives.tsx      # StatCard, SectionCard, StatusBadge, ConfirmDialog, CurrencyDisplay
│   │   └── selectors.tsx       # Combobox selectors for Products, Customers, Suppliers, Branches
│   └── ui/                     # Low-level shadcn/ui components
├── domain/                     # Pure TypeScript domain models (zero framework dependencies)
│   ├── features.ts             # Feature flags and readiness state
│   ├── permissions.ts          # 5 Roles × 44 Granular permissions matrix
│   └── types.ts                # Full entity definitions (Tenant, Branch, Product, Sale, Invoice, etc.)
├── hooks/
│   └── use-session.ts          # Session hydration, active branch, and RBAC `can()` helper
├── lib/
│   ├── format.ts               # formatCurrency (ETB), formatDate, formatDateTime, formatQuantity
│   └── utils.ts                # Class merge utility (cn)
├── mocks/
│   └── seed.ts                 # Comprehensive realistic Ethiopian seed data
├── repositories/
│   └── mock-repository.ts      # In-memory database singleton, audit logger, delay simulator
├── routes/                     # 18 TanStack Router file routes
│   ├── __root.tsx              # Root app shell, query provider, error boundaries
│   ├── index.tsx               # Executive dashboard (KPIs, charts, low stock alerts)
│   ├── pos.tsx                 # Full-featured POS counter terminal
│   ├── sales.tsx               # Sales history with receipt reprint & filters
│   ├── returns.tsx             # Sales return workflow linked to original invoice
│   ├── products.tsx            # Product catalog CRUD, pricing, barcode, CSV import
│   ├── inventory.tsx           # Multi-tab: Stock levels, Transfers, Counts, Ledger
│   ├── quotations.tsx          # B2B quotations, validity, convert to Sales Order
│   ├── orders.tsx              # Sales orders fulfillment, convert to Invoice
│   ├── invoices.tsx            # Invoices, balance tracking, payments, cancellations
│   ├── purchasing.tsx          # Purchase orders & Goods Receiving (GRN) workflow
│   ├── suppliers.tsx           # Vendor master data & purchase history
│   ├── customers.tsx           # CRM (Individual, Business, School, NGO, Gov)
│   ├── payments.tsx            # Cash & Bank payment settlements
│   ├── expenses.tsx            # Operating expenses & overhead tracking
│   ├── reports.tsx             # 5 tabs: Sales, Profitability, Purchasing, Stock, Tax
│   ├── admin.tsx               # Users, Branches, Roles Matrix, Audit log
│   └── settings.tsx            # Company TIN, Tax categories, Prefixes, Hardware, Features
├── services/                   # Service layer isolating all business logic
│   ├── auth.service.ts         # Authentication & token verification
│   ├── catalog.service.ts      # Product, branch, user, customer, supplier CRUD
│   ├── documents.service.ts    # Quotation → Sales Order → Invoice lifecycle
│   ├── finance.service.ts      # Payments, expenses, audit trails, notifications
│   ├── fiscal.service.ts       # Ethiopian ERCA / MOR fiscal device placeholder
│   ├── hardware.service.ts     # Keyboard wedge barcode, browser printer, drawer kick
│   ├── inventory.service.ts    # Double-entry ledger, transfers, stock counts
│   ├── purchasing.service.ts   # Purchase orders and goods receiving
│   ├── report.service.ts       # Aggregations for sales trends, margins, taxes
│   ├── sales.service.ts        # POS checkout, shift reconciliation
│   └── tax.service.ts          # TaxEngine: centralized 15% VAT / 2% TOT math
└── routeTree.gen.ts            # Generated TanStack route tree
```

---

## 4. Key Architectural Patterns

### 4.1 Service Layer Pattern
All data access follows the pattern:
```
React Component → TanStack Query (useQuery / useMutation) → Service Method → Repository (mock-repository.ts)
```
- **Rule**: Never execute business logic, tax computations, or direct state mutation inside UI components.
- When moving to a backend, replace the functions in `src/services/*.ts` with `fetch` / `axios` calls to your backend API endpoints. The components will require zero structural changes.

### 4.2 Single Source of Truth for Tax (`taxService`)
Ethiopian tax regulations require strict calculation of Value Added Tax (VAT 15%) or Turnover Tax (TOT 2%).
- `taxService.computeLine(line)` and `taxService.computeDocument(lines)` must be used everywhere.
- Do not inline `subtotal * 0.15` in UI components.
- Tax configuration is dynamic and loaded from `taxService.getConfiguration()`.

### 4.3 Append-Only Inventory Ledger
The inventory system in `inventory.service.ts` uses an append-only transaction ledger (`InventoryTransaction`).
- Inventory balances (`InventoryBalance`) represent the latest cached balance per product and location.
- Adjustments, sales, returns, transfers, and goods receiving create ledger entries.
- Stock transfers follow a 4-step state machine: `Requested` → `Approved` → `In Transit` (stock leaves source) → `Received` (stock lands at destination). Stock is never transferred instantaneously.

### 4.4 Sales Order & Invoicing Lifecycle
The B2B sales pipeline strictly enforces document states:
1. `Quotation` (`Draft` → `Sent` → `Accepted` / `Rejected`)
2. `convertQuotationToOrder()` produces a `SalesOrder` (`Confirmed` / `Partially Fulfilled` / `Fulfilled`)
3. `convertOrderToInvoice()` produces an `Invoice` (`Issued` → `Partially Paid` → `Paid`)
4. Cancelled invoices are NEVER hard-deleted; their status is set to `Cancelled` with an audit reason, preserving the sequential audit trail.

---

## 5. Hardware & External System Adapters

### 5.1 Barcode Scanner (`hardware.service.ts`)
- Implemented as a keyboard-wedge HID listener (`KeyboardBarcodeScanner`).
- Buffers rapid keystrokes (<120ms between keys) ending in `Enter` to emit scan events into the POS terminal.

### 5.2 Receipt & Invoice Printer (`hardware.service.ts`)
- Thermal POS receipts use an 80mm printable layout rendered to a hidden iframe with standard browser print triggers.
- Invoices and quotations use standard A4 portrait layouts.
- ESC/POS direct USB/Serial printing is stubbed with honest status reporting for Phase 3 desktop packaging.

### 5.3 Fiscal Device Adapter (`fiscal.service.ts`)
- Connects to Ethiopian Ministry of Revenues (MOR / ERCA) certified fiscal printers.
- Currently operates in mock mode, clearly flagged in receipt previews as "Document is not a fiscal receipt".

---

## 6. Recommended Backend Implementation Order (Cursor Instructions)

When building the backend to back this frontend, follow this sequence:

1. **Database Schema Setup (`docs/DATABASE.md`)**:
   - Provision PostgreSQL database.
   - Run migrations for Tenants, Users, Branches, Products, and Inventory Balances.
2. **Authentication & Multi-Tenant Middleware**:
   - Implement JWT authentication with `tenantId` and `branchId` claims.
   - Enforce row-level security (RLS) or schema-level scoping on all tables.
3. **Product Catalog & Inventory Ledger API**:
   - Endpoints: `GET /api/products`, `POST /api/inventory/adjust`, `POST /api/inventory/transfers`.
   - Implement database triggers or transactions to ensure atomic ledger postings.
4. **POS & Sales Checkouts**:
   - Endpoint: `POST /api/sales` accepting cart lines, cashier session ID, and payment methods.
5. **Wholesale Pipeline API**:
   - Endpoints for Quotations, Sales Orders, and Invoices.
6. **Purchasing & Goods Receiving (GRN)**:
   - Ensure receiving goods automatically increments warehouse stock balances.
7. **Reporting & Exports**:
   - Server-side aggregation queries for the reports in `src/services/report.service.ts`.

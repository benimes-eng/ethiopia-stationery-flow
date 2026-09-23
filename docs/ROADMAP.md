# Product Engineering Roadmap

This document outlines the multi-phase engineering roadmap for Abay Stationery Enterprise SaaS.

---

## Phase 1: Frontend Application Foundation & Architecture ✅ (COMPLETE)

- [x] **Project Infrastructure**: TanStack Start, TanStack Router file-based routing, Tailwind CSS, shadcn/ui.
- [x] **Domain Modeling**: Complete type model across 30+ business entities with tenant-scoping.
- [x] **RBAC System**: 5 Roles × 44 granular permissions with visual matrix UI.
- [x] **In-Memory Ledger & Repository**: Realistic seed data for Addis Ababa branches, append-only inventory ledger, and audit tracking.
- [x] **POS Terminal**: Counter checkout, barcode scanning keyboard wedge, customer assignment, payment drawer, and 80mm thermal receipt printing.
- [x] **Wholesale Pipeline**: Quotation builder, sales order confirmation, and invoice payment recording.
- [x] **Inventory Control**: Live stock balances, manual adjustments, inter-branch multi-step transfers, and physical stock count sheets.
- [x] **Purchasing & GRN**: Purchase order generation, supplier management, and goods receipt tracking that increments stock.
- [x] **Finance & Overhead**: Operating expense logging and manual cash/bank payment collection.
- [x] **Operational Reporting**: Recharts dashboards for sales trends, branch breakdowns, cashier performance, profitability, and tax calculations with CSV exports.
- [x] **Settings & Administration**: Branch management, staff user directory, company tax profile (TIN/VAT), document prefixes, and hardware status cards.

---

## Phase 2: Production Backend & Persistence (NEXT)

- [ ] **PostgreSQL Provisioning**:
  - Implement relational schema as detailed in `docs/DATABASE.md`.
  - Configure Row Level Security (RLS) policies scoped by `tenant_id`.
- [ ] **Backend API Development**:
  - Implement REST or GraphQL endpoints replacing `src/services/*.ts` implementations.
  - Add JWT authentication, token refresh, and session revocation.
- [ ] **Transaction Concurrency & Atomic Ledgers**:
  - Wrap POS checkout and Goods Receiving inside atomic database transactions (`SERIALIZABLE` or `SELECT FOR UPDATE`) to prevent overselling.
- [ ] **Server-Side Document Generation**:
  - High-resolution server-side PDF generation for invoices and quotations with Ethiopian Amharic font support (Noto Sans Ethiopic).
- [ ] **Excel / PDF Export Endpoints**:
  - Replace client CSV downloads with formatted server-side Excel/PDF report exports.

---

## Phase 3: Hardware & Ethiopian Fiscal Integration

- [ ] **Direct Thermal Printing (ESC/POS)**:
  - Implement WebUSB and WebSerial printer drivers in `hardware.service.ts` to bypass the browser print dialog for instant printing.
- [ ] **Cash Drawer Kick**:
  - Connect standard RJ11/RJ12 drawer kick relays via ESC/POS command sequences (`ESC p 0 25 250`).
- [ ] **Ethiopian Fiscal Device Certification**:
  - Implement the real `FiscalAdapter` interface connecting to Ministry of Revenues (MOR) certified fiscal printers.
  - Implement QR code generation compliant with Ethiopian electronic tax receipt standards.
- [ ] **Desktop Packaging (Electron / Tauri)**:
  - Package application for Windows workstations to bundle hardware USB/Serial drivers without browser permission barriers.

---

## Phase 4: Offline Resilience & Enterprise Integrations

- [ ] **Offline POS Capability**:
  - Local IndexedDB storage for offline product catalogs and queueing offline sales transactions.
  - Idempotent background synchronization when network re-establishes.
- [ ] **Ethiopian Mobile Payment APIs**:
  - Direct integration with Telebirr, CBE Birr, and Awash Bank APIs for dynamic QR code generation on the customer-facing display.
- [ ] **Printing & Copy Services Module**:
  - Job tracking for binding, lamination, high-volume blueprint plotting, and photocopy orders (enabled via `printingServices` feature flag).
- [ ] **Automated Bank Reconciliation**:
  - Import CBE, Awash, and Dashen bank statement files (CSV/MT940) to automatically reconcile invoice payments against bank deposits.

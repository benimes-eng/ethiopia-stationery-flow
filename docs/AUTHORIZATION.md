# Authorization & Access Control Architecture

## 1. Multi-Layered Security Boundary

Authorization is enforced at two distinct tiers:
1. **Presentation Layer (UX)**: Guards routes and hides UI actions using `can(permission)` to provide a clean user experience.
2. **Server-Side Layer (Security Boundary)**: The Fastify API independently enforces role permissions on every single request via `requirePermission(permission)`. A forged frontend request without proper role claims is immediately rejected with `403 Forbidden`.

---

## 2. Predefined Roles & Permission Sets

| Role | Scope | Description |
| :--- | :--- | :--- |
| **Owner** | Tenant-Wide | Full administrative and operational access across all branches, warehouses, and settings. |
| **Manager** | Branch / Tenant | Manages sales, inventory adjustments, purchase approvals, staff; cannot delete core entities or modify system settings. |
| **Cashier** | Assigned Branch | Restricted strictly to POS counter sales, receipt reprint, customer lookup, and cash collection. Cannot modify pricing. |
| **Storekeeper**| Assigned Warehouse | Manages inventory receiving, stock count sheets, and inter-branch transfer dispatches. |
| **Accountant** | Tenant-Wide | Access to invoices, payments, operating expense records, tax summaries, and financial reports. |

---

## 3. Branch & Location Scoping

Users have an assigned `branch_id` stored in their token and profile:
- **Tenant Admins & Owners**: Can perform operations across all locations (`branchId: null` or global wildcard).
- **Cashiers**: Can only ring POS checkouts and query sales for their assigned branch. Attempts to execute transactions for another branch trigger a `BRANCH_FORBIDDEN` error.
- **Storekeepers**: Limited to warehouse locations where they are authorized.

---

## 4. Middleware Implementation

Every protected route attaches the permission preHandler:

```typescript
fastify.post("/adjust", {
  preHandler: [
    authenticate,
    requirePermission("inventory.adjust"),
    requireBranchScope((req) => req.body.locationId)
  ]
}, handler);
```

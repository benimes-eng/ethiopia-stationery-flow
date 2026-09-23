# Multi-Tenancy & Data Isolation Architecture

## 1. Isolation Model

Abay Stationery Enterprise SaaS utilizes a **Shared Database, Shared Schema with Tenant Discriminator and Row-Level Security (RLS)** architecture.

Every tenant-owned table contains a mandatory `tenant_id` column indexed for fast partition lookups:
```sql
ALTER TABLE products ADD COLUMN tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX idx_products_tenant ON products(tenant_id);
```

---

## 2. Server-Enforced Context (Zero Trust Frontend)

The backend **never trusts a `tenant_id` sent in the request body or query string**.
- The `tenant_id` is derived strictly from the cryptographically verified JWT access token.
- In every database transaction, the tenant context is set on the PostgreSQL connection:
```sql
SELECT set_config('app.current_tenant_id', 'tenant-abay', true);
```

---

## 3. PostgreSQL Row-Level Security (RLS)

As a second defense-in-depth security boundary, PostgreSQL RLS policies ensure that even if an application SQL query omitted `WHERE tenant_id = ...`, the database engine will not return records belonging to other tenants:

```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create Tenant Isolation Policy
CREATE POLICY tenant_isolation_policy ON products
    FOR ALL
    USING (tenant_id = get_current_tenant_id())
    WITH CHECK (tenant_id = get_current_tenant_id());
```

---

## 4. Tenant Deletion & Data Retention

When a tenant account is closed:
- Soft-deletion disables all active users and sessions immediately.
- In accordance with Ethiopian financial archiving standards, transactional ledgers and invoices are retained in an immutable state for 10 years before physical purge.

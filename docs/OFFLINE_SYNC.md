# Offline POS Synchronization Architecture

## 1. Resilience Philosophy

Power outages and internet interruptions are frequent operational realities for retail businesses in Ethiopia. The POS terminal must remain capable of ringing sales during temporary connectivity outages without losing customer trust.

---

## 2. Architecture & Data Flow

```
Cashier Rings Sale
        │
        ▼
Is Browser Online?
   ├── YES ──▶ POST /api/v1/pos/checkout (Standard API Path)
   │
   └── NO ───▶ Write to IndexedDB (`abay_pos_offline_db`)
                     │
                     ▼
               Generate Offline Receipt ("OFF-XXXXXX")
                     │
                     ▼
               Network Restores (Window 'online' event)
                     │
                     ▼
               Background Sync Engine Replays Queued Transactions
                     │
                     ▼
               Server Commits with Idempotency Key
                     │
                     ▼
               Transaction Marked `synced` in IndexedDB
```

---

## 3. IndexedDB Schema

- Database: `abay_pos_offline_db` (Version 1)
- Object Store: `offline_transactions`
  - `id`: Client transaction UUID (Primary Key)
  - `idempotencyKey`: Unique deduplication key
  - `operation`: `'POS_SALE'` or `'PAYMENT'`
  - `payload`: Serialized cart lines, payment amount, customer ID
  - `status`: `'queued'`, `'syncing'`, `'synced'`, `'failed'`
  - `attempts`: Retry counter
  - `lastError`: Error message if sync rejected

---

## 4. Conflict Resolution Strategy

When offline transactions are replayed against the live database:
1. **Idempotency Guarantee**: If a transaction was partially received before the outage, the server detects the idempotency key and returns the existing record.
2. **Inventory Stock Depletion**: In rare instances where an offline sale depletes an item that was concurrently sold elsewhere, the server registers the sale and logs an `AUDIT_OFFLINE_STOCK_DEFICIT` alert for managerial review and manual ledger adjustment.

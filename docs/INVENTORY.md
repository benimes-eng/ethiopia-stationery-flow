# Authoritative Inventory & Ledger Architecture

## 1. Overview & Core Philosophy

The PostgreSQL database is the sole source of inventory truth. The browser is purely an interface and cache; it is never authoritative for stock levels.

Key design principles:
1. **Append-Only Ledger**: Balances are calculated and audited against an immutable stream of transactions (`inventory_transactions`).
2. **Concurrency Serialization**: Row-level locking (`SELECT ... FOR UPDATE`) prevents simultaneous checkouts from overselling inventory.
3. **Strict Non-Negative Rules**: Stock cannot drop below zero unless the tenant explicitly enables negative inventory in `tenant_settings`.
4. **Weighted Average Costing (WAC)**: Valuation updates dynamically as shipments arrive at different supplier prices.

---

## 2. Transaction Types & Inflow/Outflow Signage

| Type | Delta Sign | Description | Trigger |
| :--- | :--- | :--- | :--- |
| `PURCHASE` | `+` (Inbound) | Goods arriving from vendor | Goods Receipt Note (GRN) |
| `SALE` | `-` (Outbound) | Retail or wholesale sale | POS Checkout / Invoice fulfillment |
| `SALES_RETURN` | `+` (Inbound) | Customer returns good item | Return restock workflow |
| `TRANSFER_OUT`| `-` (Outbound) | Leaves dispatch location | Transfer status -> `In Transit` |
| `TRANSFER_IN` | `+` (Inbound) | Arrives at destination | Transfer status -> `Received` |
| `ADJUSTMENT` | `+/-` | Audit count correction | Stock adjustment form |
| `DAMAGE` | `-` (Outbound) | Damaged or expired paper/pen | Write-off adjustment |

---

## 3. Concurrency Lock & Anti-Oversell Engine

When a checkout or transfer is initiated, the database row is locked before any deduction:

```sql
SELECT quantity, average_cost 
FROM inventory_balances 
WHERE tenant_id = $1 AND product_id = $2 AND location_id = $3 
FOR UPDATE;
```

If `current_quantity + delta < 0` and `allow_negative_stock = false`, an `InsufficientStockError` is thrown, rolling back the transaction.

---

## 4. Weighted Average Costing (WAC) Formula

When new stock arrives via a Goods Receipt Note (GRN):

$$\text{New Average Cost} = \frac{(\text{Current Qty} \times \text{Current Avg Cost}) + (\text{Received Qty} \times \text{Unit Purchase Cost})}{\text{Current Qty} + \text{Received Qty}}$$

Sales, returns, and inter-branch transfers carry the prevailing weighted average cost and do not distort the unit valuation.

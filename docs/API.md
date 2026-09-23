# REST API Specification & Endpoint Contracts

Base URL: `http://localhost:4000/api/v1`

All requests and responses use JSON. Authenticated endpoints require `Authorization: Bearer <access_token>`.

---

## 1. Authentication (`/auth`)

### `POST /auth/login`
Authenticates a user against Argon2id password hash and returns JWT access + refresh tokens.

**Request Body:**
```json
{
  "email": "cashier@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "user-cashier",
    "name": "Yared Bekele",
    "email": "cashier@example.com",
    "role": "cashier",
    "branchId": "loc-bole",
    "permissions": ["pos.access", "sales.view", "sales.create", "invoices.view"]
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
}
```

### `GET /auth/me`
Returns current authenticated user session and permissions.

---

## 2. Point of Sale & Checkout (`/pos`)

### `POST /pos/checkout`
Executes an atomic checkout transaction with row locks, inventory deduction, receipt, invoice, and payment generation.

**Headers:**
- `Authorization: Bearer <token>`
- `Idempotency-Key: <unique-client-uuid>` (Mandatory)

**Request Body:**
```json
{
  "branchId": "loc-bole",
  "registerId": "REG-01",
  "customerId": "cus-walkin",
  "channel": "retail",
  "lines": [
    {
      "productId": "prod-paper-a4",
      "description": "A4 Copy Paper 80gsm",
      "quantity": 2,
      "unitPrice": 3850.00,
      "discount": 0,
      "taxRate": 0.15
    }
  ],
  "payment": {
    "method": "Cash",
    "amount": 9000.00
  }
}
```

**Response (201 Created):**
```json
{
  "saleId": "sale-x912a",
  "receiptNumber": "REC-1042",
  "invoiceNumber": "INV-1089",
  "paymentNumber": "PAY-1042",
  "totals": {
    "subtotal": 7700.00,
    "discount": 0.00,
    "taxable": 7700.00,
    "tax": 1155.00,
    "total": 8855.00
  },
  "change": 145.00,
  "status": "completed",
  "timestamp": "2026-09-04T19:30:00.000Z"
}
```

### `POST /pos/returns`
Processes a sales return and restocks inventory via an append-only `SALES_RETURN` ledger transaction.

---

## 3. Inventory & Ledger (`/inventory`)

### `GET /inventory/balances`
Query params: `locationId`, `search`. Returns on-hand stock and weighted average unit cost.

### `GET /inventory/ledger`
Query params: `locationId`, `productId`, `type`. Returns immutable ledger history.

### `POST /inventory/adjust`
Manually adjusts stock for damage, shrinkage, or audit corrections with row locking.

### `POST /inventory/transfers`
Creates an inter-branch transfer request (`Draft` -> `Requested` -> `Approved` -> `In Transit` -> `Received`).

---

## 4. Wholesale Pipeline (`/documents`)

- `GET /documents/quotations`
- `POST /documents/quotations`
- `POST /documents/quotations/:id/convert` (Converts to Sales Order)
- `GET /documents/orders`
- `POST /documents/orders/:id/convert` (Converts to Invoice)
- `GET /documents/invoices`
- `POST /documents/invoices/:id/cancel`

---

## 5. Purchasing & Goods Receipt (`/purchasing`)

- `GET /purchasing/suppliers`
- `POST /purchasing/suppliers`
- `GET /purchasing/orders`
- `POST /purchasing/orders`
- `POST /purchasing/receive` (Creates Goods Receipt Note & increments physical inventory)

---

## 6. Financial Management (`/finance`)

- `GET /finance/payments`
- `POST /finance/payments` (Records cash/bank payment against invoice, updating invoice balance)
- `GET /finance/expenses`
- `POST /finance/expenses`

---

## 7. Reports & Analytics (`/reports`)

- `GET /reports/kpis?from=YYYY-MM-DD&to=YYYY-MM-DD&branchId=...`
- `GET /reports/trend`
- `GET /reports/tax`

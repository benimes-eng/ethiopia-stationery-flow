# Stationery Hub Pro

# MASTER DEVELOPMENT PROMPT — ETHIOPIAN STATIONERY BUSINESS MANAGEMENT SaaS

## ROLE

You are a senior product engineer, SaaS architect, UX designer, and frontend engineer.

Build the complete frontend and application foundation for a **production-grade multi-tenant SaaS platform for medium-to-large Ethiopian stationery businesses**.

This is NOT a generic POS demo.

This is NOT a landing-page project.

This is NOT a simplified CRUD dashboard.

Build the application as if it will eventually be used by real stationery businesses operating multiple branches, warehouses, retail counters, and wholesale operations.

The application must have complete navigation, screens, UI states, forms, workflows, validation, realistic seed data, reusable components, responsive behavior, and a clean architecture that another senior engineer using Cursor can continue into the heavy backend/infrastructure work without having to redesign the application.

---

# 1. PRODUCT DEFINITION

Product:

**Ethiopian Stationery Business Management SaaS**

Target customers:

* Medium-to-large stationery retailers
* Stationery wholesalers
* School-supply businesses
* Office-supply businesses
* Corporate stationery suppliers
* Multi-branch stationery businesses

The system supports:

* Retail sales
* Wholesale sales
* Multi-branch operations
* Warehouse inventory
* Purchasing
* Quotations
* Sales orders
* Invoicing
* Cash payments
* Manually recorded bank payments
* Customers
* Suppliers
* Employees
* Roles and permissions
* Inventory transfers
* Stock counts
* Stock adjustments
* Expenses
* Reports
* Tax-aware architecture
* Future extensibility for Ethiopian tax/e-invoicing
* Future extensibility for printing/copy services
* Future extensibility for payment integrations
* Future extensibility for offline POS and hardware integration

---

# 2. IMPORTANT SCOPE RULE

Do NOT implement or pretend to fully implement the following heavy infrastructure yet:

* Ethiopian Ministry of Revenue API integration
* Electronic invoicing API integration
* QR verification integration
* Bank API integration
* Telebirr integration
* Mobile-money integrations
* Customer credit/accounts receivable
* Delivery management
* Print/copy service engine
* Automatic break-pack/decomposition engine
* Production offline synchronization engine
* WebSerial hardware implementation
* WebUSB hardware implementation
* ESC/POS device daemon
* Advanced accounting/general ledger
* Payroll
* AI forecasting
* Complex background processing

However:

**DO NOT remove these concepts from the architecture.**

Create clean interfaces, placeholders, configuration structures, service boundaries, feature flags, and TODO markers where appropriate so Cursor can implement them later without restructuring the entire application.

The application must be modular.

---

# 3. CRITICAL PRODUCT PRINCIPLE

The application must be designed around:

```text
PURCHASE
    ↓
RECEIVE
    ↓
INVENTORY
    ↓
SELL
    ↓
INVOICE
    ↓
PAYMENT
    ↓
REPORT
```

Wholesale flow:

```text
CUSTOMER
    ↓
QUOTATION
    ↓
SALES ORDER
    ↓
INVOICE
    ↓
PAYMENT
    ↓
INVENTORY UPDATE
```

Never design the modules as isolated CRUD pages.

They must feel like one connected business system.

---

# 4. TECH STACK

Use:

* React
* TypeScript
* Next.js if supported by the project
* Tailwind CSS
* shadcn/ui
* Lucide icons
* TanStack Query where appropriate
* React Hook Form
* Zod
* Zustand where local state is useful

Use a clean feature-based architecture.

Avoid unnecessary dependencies.

Do not introduce a large UI framework when shadcn/ui + Tailwind is sufficient.

---

# 5. DESIGN DIRECTION

Create a **premium enterprise SaaS interface**.

The UI should feel like a serious modern business platform.

Reference qualities:

* Clean
* Professional
* Elegant
* Information-dense without being cluttered
* Fast
* Operational
* Modern
* Minimal
* Highly usable

Do NOT make it look like:

* A generic admin template
* A cryptocurrency dashboard
* A gaming interface
* A marketing website
* A flashy gradient-heavy SaaS template

Use subtle motion only where it improves usability.

Prioritize clarity over decoration.

---

# 6. DESIGN SYSTEM

Create a consistent design system.

Use:

* 8px spacing system
* Consistent border radius
* Consistent typography hierarchy
* Consistent table styles
* Consistent form controls
* Consistent buttons
* Consistent status badges
* Consistent empty states
* Consistent loading states
* Consistent error states
* Consistent confirmation dialogs
* Consistent toast notifications

Primary font:

**Inter**

Architecture must be ready for:

**Noto Sans Ethiopic**

for future Amharic localization.

Do not hard-code text into images.

---

# 7. APPLICATION SHELL

Create a desktop-first enterprise layout.

Structure:

```text
┌───────────────────────────────────────────────────────────┐
│ Logo │ Search │ Branch │ Notifications │ User            │
├──────┼────────────────────────────────────────────────────┤
│      │                                                    │
│ Side │                                                    │
│ bar  │                  MAIN CONTENT                      │
│      │                                                    │
│      │                                                    │
└──────┴────────────────────────────────────────────────────┘
```

Sidebar:

## Overview

* Dashboard

## Sales

* POS
* Quotations
* Sales Orders
* Invoices
* Returns

## Inventory

* Products
* Stock
* Transfers
* Stock Counts
* Adjustments

## Purchasing

* Purchase Orders
* Goods Receiving
* Suppliers

## Customers

* Customers

## Finance

* Payments
* Expenses

## Reports

* Sales
* Inventory
* Purchasing
* Profitability
* Tax

## Administration

* Branches
* Users
* Roles & Permissions

## Settings

* Company
* Invoice
* Tax
* Payment Methods
* System

---

# 8. GLOBAL HEADER

Header must include:

### Global search

Search across:

* Products
* SKU
* Barcode
* Customers
* Suppliers
* Invoices
* Sales orders
* Quotations

### Branch selector

Example:

```text
All Branches
Addis Main
Hawassa Branch
Bahir Dar Branch
Main Warehouse
```

The selected branch should influence pages where appropriate.

### Notifications

Examples:

* Low stock
* Pending quotation
* Purchase order awaiting approval
* Stock transfer awaiting receipt
* Invoice issue
* System notification

### User menu

Show:

* Name
* Role
* Current branch
* Profile
* Settings
* Logout

---

# 9. AUTHENTICATION

Build complete UI flows for:

* Login
* Forgot password
* Reset password
* Session expired
* Unauthorized
* Forbidden
* First-time onboarding

Do not use fake authentication UX that exposes all pages regardless of role.

Create a proper permission-aware navigation architecture.

For development, use seeded users.

---

# 10. MULTI-TENANT ARCHITECTURE

The application must assume:

```text
Platform
   │
   ├── Tenant A
   │    ├── Branches
   │    ├── Users
   │    ├── Products
   │    ├── Inventory
   │    └── Transactions
   │
   ├── Tenant B
   │    ├── Branches
   │    ├── Users
   │    └── Transactions
   │
   └── Tenant C
```

Every business entity must conceptually belong to a tenant.

Use:

```text
tenantId
```

throughout the data model.

Never create global business data accidentally.

---

# 11. USER ROLES

Create these roles:

## Owner

Full access.

## Manager

Operational management.

## Cashier

POS and sales operations.

## Storekeeper

Inventory and receiving.

## Accountant

Invoices, payments, expenses and financial reports.

Do not simply hide buttons.

Create a permission model.

---

# 12. PERMISSION MODEL

Create permissions such as:

```text
dashboard.view

pos.access

sales.view
sales.create
sales.edit
sales.return

quotations.view
quotations.create
quotations.edit
quotations.convert

orders.view
orders.create
orders.edit
orders.approve

invoices.view
invoices.create
invoices.cancel

products.view
products.create
products.edit
products.delete

inventory.view
inventory.adjust
inventory.transfer
inventory.receive
inventory.count

purchases.view
purchases.create
purchases.approve
purchases.receive

customers.view
customers.create
customers.edit

suppliers.view
suppliers.create
suppliers.edit

payments.view
payments.create

expenses.view
expenses.create

reports.sales
reports.inventory
reports.purchase
reports.profit
reports.tax

branches.manage

users.manage
roles.manage

settings.manage
```

Create a role-to-permission matrix.

---

# 13. ONBOARDING

Build a multi-step onboarding wizard.

### Step 1

Business information.

Fields:

* Business name
* Legal name
* TIN
* VAT registration status
* Phone
* Email
* Address
* Logo

### Step 2

First branch.

### Step 3

Warehouse configuration.

### Step 4

Tax configuration.

### Step 5

Payment methods.

### Step 6

Create first user.

### Step 7

Import products.

Allow:

* CSV upload UI
* Template download UI
* Validation preview
* Import result

The backend import can remain mocked/stubbed.

---

# 14. DASHBOARD

Create a highly polished owner/manager dashboard.

Top KPI cards:

```text
Today's Sales
ETB 245,400

Transactions
382

Gross Profit
ETB 61,200

Inventory Value
ETB 8.4M

Low Stock
23
```

Charts:

### Sales trend

7/30/90-day selector.

### Sales by branch

### Top-selling products

### Gross profit

### Purchase trend

### Inventory alerts

Tables:

* Low-stock products
* Recent sales
* Pending quotations
* Pending purchase orders
* Recent stock movements

Allow date filtering.

Allow branch filtering.

---

# 15. POS

This is a PRIMARY feature.

Build a dedicated POS screen.

Do not make it look like a normal CRUD page.

Layout:

```text
┌──────────────────────────────────────────────────────────┐
│ Branch │ Register │ Cashier │ Time                       │
├──────────────────────────┬───────────────────────────────┤
│                          │                               │
│ SEARCH / BARCODE         │ CART                          │
│                          │                               │
│ Product results          │ Product × Qty                 │
│                          │ Product × Qty                 │
│                          │ Product × Qty                 │
│                          │                               │
│                          │                               │
│                          │ Subtotal                      │
│                          │ Discount                      │
│                          │ Tax                            │
│                          │ TOTAL                          │
│                          │                               │
│                          │ [ CASH ] [ BANK ]              │
│                          │                               │
│                          │ COMPLETE SALE                 │
└──────────────────────────┴───────────────────────────────┘
```

Features:

* Product search
* Barcode input
* Quantity
* Remove item
* Discount
* Customer
* Tax
* Payment
* Receipt
* Invoice
* Hold sale
* Resume sale
* Returns
* Recent sales

Add keyboard shortcuts:

```text
F2 Search
F4 Customer
F8 Hold
F9 Payment
ESC Close modal
Enter Confirm
Delete Remove item
```

Show shortcuts in a help overlay.

---

# 16. POS PAYMENT

Payment methods:

```text
Cash
Bank
```

For Bank:

```text
Bank
Reference
Amount
```

Provide configurable bank list.

Seed examples:

* Commercial Bank of Ethiopia
* Awash Bank
* Dashen Bank
* Bank of Abyssinia
* Hibret Bank
* Other

This is ONLY recording.

Do NOT implement bank API integration.

---

# 17. POS TERMINAL ARCHITECTURE

Prepare the frontend for future hardware integration.

Architecture:

```text
Browser
   │
   ├── Barcode Scanner
   ├── Thermal Printer
   └── Cash Drawer
```

For now:

### Barcode scanner

Support normal keyboard/HID scanner behavior.

Create an abstraction:

```text
BarcodeScannerService
```

with methods such as:

```text
initialize()
listen()
disconnect()
```

Implement a basic keyboard-input adapter.

Do NOT implement WebSerial/WebUSB yet.

---

### Thermal printer

Create:

```text
PrinterService
```

with:

```text
printReceipt()
printInvoice()
testPrint()
```

For MVP frontend:

* Browser print
* Printable receipt layout
* Printable A4 invoice layout
* Printer test screen

Do not pretend that direct ESC/POS communication exists.

Leave a clean adapter interface for Cursor.

---

### Cash drawer

Create:

```text
CashDrawerService
```

with:

```text
openDrawer()
testDrawer()
```

For now:

```text
Not connected
```

Display a clear "hardware integration coming later" state in settings.

Do not simulate a real cash drawer opening.

---

# 18. PRODUCT MANAGEMENT

Create:

### Product list

Columns:

* SKU
* Product
* Category
* Brand
* Barcode
* Stock
* Cost
* Retail price
* Wholesale price
* Status

Actions:

* View
* Edit
* Archive
* Stock history

### Product creation

Fields:

* Product name
* SKU
* Barcode
* Category
* Brand
* Description
* Unit
* Purchase cost
* Retail price
* Wholesale price
* Reorder level
* Tax category
* Supplier
* Active status

---

# 19. UNIT OF MEASURE

Keep UOM modular.

Support examples:

* Piece
* Pack
* Box
* Ream
* Carton
* Set

But DO NOT implement automatic break-pack/decomposition.

Do not create complex package conversion logic in this phase.

Create extensible fields:

```text
unitOfMeasure
purchaseUnit
salesUnit
conversionRules
```

Leave advanced conversion rules as future functionality.

---

# 20. INVENTORY

Create inventory dashboard.

Show:

* Total SKUs
* Total stock units
* Inventory value
* Low stock
* Out of stock
* Recent movements

Product stock detail:

```text
Product
Location
Quantity
Average Cost
Retail Value
Status
```

Locations:

* Branch
* Warehouse

---

# 21. INVENTORY TRANSACTION UI

Every stock movement should conceptually have:

```text
transactionId
tenantId
productId
locationId
type
quantity
reference
user
timestamp
```

Transaction types:

```text
PURCHASE
SALE
RETURN
TRANSFER_OUT
TRANSFER_IN
ADJUSTMENT
DAMAGE
SCRAP
```

Build a stock history screen.

Make it obvious that the ledger is intended to be immutable.

Do not create UI that casually edits historical transactions.

---

# 22. STOCK ADJUSTMENT

Create:

```text
Inventory → Adjust Stock
```

Fields:

* Product
* Location
* Adjustment type
* Quantity
* Reason
* Notes

Reasons:

* Damage
* Loss
* Found stock
* Counting correction
* Other

Require confirmation.

Show before/after quantities.

---

# 23. STOCK COUNT

Build:

```text
Inventory
→ Stock Counts
→ New Count
```

Workflow:

```text
Create Count
↓
Select Location
↓
Count Products
↓
Enter Physical Quantity
↓
Show Variance
↓
Submit
↓
Manager Approval
↓
Adjustment
```

Example:

```text
System: 500
Physical: 493
Variance: -7
```

---

# 24. STOCK TRANSFERS

Workflow:

```text
Branch A
↓
Transfer Request
↓
Approval
↓
Dispatch
↓
In Transit
↓
Receive
↓
Branch B
```

Create statuses:

```text
Draft
Requested
Approved
In Transit
Received
Cancelled
```

Do not instantly add stock to destination when dispatched.

---

# 25. PURCHASING

Create:

### Purchase Orders

List columns:

* PO number
* Supplier
* Branch/location
* Date
* Total
* Status

Statuses:

```text
Draft
Pending Approval
Approved
Partially Received
Received
Cancelled
```

Create purchase order form.

---

# 26. GOODS RECEIVING

Dedicated receiving interface.

Display:

```text
Ordered
Received
Remaining
```

Example:

```text
A4 Paper
Ordered: 100
Received: 97
Remaining: 3
```

Allow partial receiving.

Receiving must eventually be connected to inventory.

For Lovable, build the complete UI and data flow using the local/mock service layer.

---

# 27. SUPPLIERS

Supplier list.

Supplier profile:

* Business name
* Legal name
* TIN
* VAT number
* Contact
* Phone
* Email
* Address
* Notes
* Purchase history

Actions:

* New purchase
* View history
* Edit

---

# 28. CUSTOMERS

Customer types:

```text
Individual
Business
School
NGO
Government
Other Organization
```

Fields:

* Name
* Organization
* TIN
* VAT number
* Phone
* Email
* Address

Do NOT implement credit accounts yet.

Do not show "outstanding balance" as if credit is supported.

---

# 29. QUOTATIONS

Build a professional quotation workflow.

```text
Customer
↓
Quotation
↓
Send
↓
Accepted
↓
Convert to Sales Order
```

Statuses:

```text
Draft
Sent
Accepted
Rejected
Expired
Converted
```

Quotation screen should support:

* Customer
* Items
* Quantity
* Unit price
* Discount
* Tax
* Total
* Valid until
* Terms
* Notes

Create printable quotation.

---

# 30. SALES ORDERS

Build:

```text
Sales
→ Sales Orders
```

Statuses:

```text
Draft
Confirmed
Partially Fulfilled
Fulfilled
Cancelled
```

Support:

```text
Quotation → Sales Order
```

and:

```text
Sales Order → Invoice
```

---

# 31. INVOICES

Create professional invoice management.

Invoice list:

* Invoice number
* Customer
* Date
* Amount
* Tax
* Payment status
* Branch
* Status

Statuses:

```text
Draft
Issued
Paid
Partially Paid
Cancelled
```

Create printable invoice.

Include configurable:

* Business name
* Address
* TIN
* VAT number
* Invoice number
* Date
* Customer information
* Items
* Quantity
* Unit price
* Discount
* Tax
* Total
* Payment method
* Notes

---

# 32. TAX ARCHITECTURE

This MUST be modular.

Create:

```text
TaxEngine
```

and:

```text
TaxConfiguration
TaxCategory
TaxRate
```

Do not hard-code tax logic into POS components.

Example:

```text
TaxCategory
├── name
├── code
├── rate
├── effectiveFrom
├── effectiveTo
└── active
```

Create an abstraction:

```text
FiscalAdapter
```

Future implementation:

```text
EthiopiaFiscalAdapter
```

But DO NOT integrate with the Ministry of Revenue now.

Create UI placeholders for:

* Tax configuration
* Invoice compliance configuration
* Fiscal integration status

Clearly label future integrations as:

**Not configured**

Do not claim compliance merely because the UI exists.

---

# 33. PAYMENTS

Create payment records.

Fields:

```text
paymentId
invoiceId
amount
method
bank
reference
receivedBy
date
```

Payment methods:

* Cash
* Bank

Build:

### Payment history

### Payment details

### Record payment

### Payment receipt

No API integration.

---

# 34. EXPENSES

Create expense management.

Fields:

* Date
* Category
* Amount
* Payment method
* Branch
* Description
* Attachment
* Recorded by

Categories:

* Rent
* Utilities
* Transport
* Supplies
* Maintenance
* Salary
* Other

Do not build payroll.

---

# 35. RETURNS

Create sales return workflow.

```text
Find Sale
↓
Select Items
↓
Quantity
↓
Reason
↓
Confirm Return
↓
Inventory Update
↓
Refund / Adjustment
```

Reasons:

* Customer return
* Damaged
* Wrong product
* Duplicate
* Other

---

# 36. END-OF-DAY CASHIER CLOSING

Build:

```text
POS
→ Register
→ Close Shift
```

Show:

```text
Opening Balance
Cash Sales
Cash Returns
Expected Cash
Actual Cash
Variance
```

Example:

```text
Expected Cash: ETB 52,400
Actual Cash:   ETB 52,350
Variance:      -ETB 50
```

Require manager review when configured.

---

# 37. REPORTS

Create a dedicated reports center.

### Sales

* Daily sales
* Monthly sales
* Sales by branch
* Sales by cashier
* Sales by product
* Sales by category

### Inventory

* Current stock
* Stock valuation
* Low stock
* Stock movement
* Stock adjustments
* Stock count variance
* Transfers

### Purchasing

* Purchases by supplier
* Purchases by branch
* Purchase trend
* Product purchase cost history

### Profitability

* Gross sales
* Discounts
* COGS
* Gross profit
* Gross margin

### Tax

* Taxable sales
* Tax totals
* Invoice summaries

All reports should support:

* Date range
* Branch
* Export
* Search
* Filters

---

# 38. REPORT EXPORT

Create UI for:

* CSV
* Excel
* PDF

If backend generation is not available yet, implement frontend export where practical and create clean service interfaces for server-side exports later.

---

# 39. BRANCH MANAGEMENT

Create:

```text
Branches
```

Fields:

* Branch name
* Code
* Address
* Phone
* Manager
* Status

Support:

```text
Main Warehouse
Addis Branch
Hawassa Branch
Bahir Dar Branch
```

Do not assume these exact branches exist in production; they are seed data.

---

# 40. USERS

User management:

Columns:

* Name
* Email
* Role
* Branch
* Status
* Last active

Actions:

* Create
* Edit
* Deactivate
* Reset password
* Assign role
* Assign branch

---

# 41. ROLES & PERMISSIONS

Create a visual permission matrix.

Example:

| Permission | Owner | Manager | Cashier | Storekeeper | Accountant |
| ---------- | ----: | ------: | ------: | ----------: | ---------: |
| Dashboard  |     ✓ |       ✓ | Limited |     Limited |          ✓ |
| POS        |     ✓ |       ✓ |       ✓ |           ✕ |          ✕ |
| Products   |     ✓ |       ✓ |    View |           ✓ |       View |
| Inventory  |     ✓ |       ✓ |    View |           ✓ |       View |
| Purchasing |     ✓ |       ✓ |       ✕ |           ✓ |          ✓ |
| Payments   |     ✓ |       ✓ |       ✓ |           ✕ |          ✓ |
| Expenses   |     ✓ |       ✓ |       ✕ |           ✕ |          ✓ |
| Tax        |     ✓ | Limited |       ✕ |           ✕ |          ✓ |
| Users      |     ✓ | Limited |       ✕ |           ✕ |          ✕ |

Make the matrix interactive.

---

# 42. SETTINGS

Build settings sections:

### Company

* Name
* Logo
* TIN
* VAT
* Contact
* Address

### Branches

### Users

### Roles

### Tax

### Invoice

### Payments

### POS

### Hardware

### System

---

# 43. HARDWARE SETTINGS

Create:

```text
Settings
→ POS Hardware
```

Sections:

### Barcode Scanner

Status:

```text
Keyboard Scanner
Connected / Not detected
```

### Receipt Printer

Status:

```text
Browser Printing
Configured / Not configured
```

Buttons:

```text
Test Print
```

### Cash Drawer

Status:

```text
Not configured
```

Button:

```text
Test
```

Include architecture placeholders for future:

```text
WebSerial
WebUSB
ESC/POS
Local Device Bridge
```

But don't implement them.

---

# 44. FUTURE MODULE PLACEHOLDERS

Create a modular feature registry.

Future modules:

```text
Print & Copy Services
Customer Credit
Delivery
Mobile Payments
Bank Integrations
Advanced Accounting
AI Forecasting
E-commerce
```

These should not appear as fake functional modules.

Instead, where appropriate, show:

**Coming later**

or keep them disabled behind feature flags.

---

# 45. FEATURE FLAG ARCHITECTURE

Create a conceptual:

```text
FeatureFlag
```

Examples:

```text
printingServices
customerCredit
offlinePOS
bankIntegration
mobilePayments
advancedAccounting
```

The application should be able to enable these later without restructuring the navigation architecture.

---

# 46. DATA MODEL

Create a clean typed model layer.

Core entities:

```text
Tenant
User
Role
Permission

Branch
Location

Category
Brand
Product
ProductBarcode
ProductPrice
UnitOfMeasure

InventoryBalance
InventoryTransaction
InventoryAdjustment
InventoryCount
InventoryTransfer

Supplier
SupplierProduct

PurchaseOrder
PurchaseOrderItem
GoodsReceipt
GoodsReceiptItem

Customer

Quotation
QuotationItem

SalesOrder
SalesOrderItem

Sale
SaleItem
SaleReturn
SaleReturnItem

Invoice
InvoiceItem

Payment

Expense

TaxCategory
TaxRate

AuditLog
```

Create relationships between them.

Do not create disconnected mock entities.

---

# 47. MOCK DATA

Seed realistic Ethiopian stationery data.

Products:

* A4 Copy Paper
* A3 Copy Paper
* Blue Ballpoint Pen
* Black Ballpoint Pen
* HB Pencil
* Eraser
* Sharpener
* Exercise Book
* Spiral Notebook
* Stapler
* Staples
* File Folder
* Manila Folder
* Marker
* Whiteboard Marker
* Glue
* Scissors
* Ruler
* Calculator
* Toner
* Printer Ink

Use realistic ETB prices.

Create:

* 3 branches
* 2 warehouses
* 20+ products
* 10 suppliers
* 20 customers
* 30 sales
* 10 purchase orders
* 10 quotations
* 10 invoices
* inventory movements
* payments
* expenses

Make the dashboard visually believable.

---

# 48. RESPONSIVE DESIGN

Desktop is the primary target.

Also support:

* Tablet
* Small laptop

POS should prioritize desktop/tablet.

Mobile should provide usable administrative access but does not need to replicate the full desktop POS experience.

---

# 49. ACCESSIBILITY

Implement:

* Keyboard navigation
* Visible focus states
* Semantic HTML
* ARIA where necessary
* Accessible dialogs
* Accessible tables
* Proper labels
* Sufficient contrast

POS should be highly keyboard-friendly.

---

# 50. LOADING STATES

Every data-heavy screen needs:

* Skeleton loading
* Empty state
* Error state
* Retry state

Do not leave blank white screens.

---

# 51. ERROR HANDLING

Create consistent:

* Toast errors
* Inline form errors
* API error states
* Permission errors
* Not found pages
* Session expiration
* Validation messages

Example:

```text
Unable to complete sale.

Your connection may have been interrupted.

Retry
```

Do not expose raw stack traces.

---

# 52. CONFIRMATION UX

Destructive operations must require confirmation.

Examples:

* Delete/archive product
* Cancel invoice
* Cancel purchase order
* Stock adjustment
* Return
* Deactivate user

For important operations require a reason.

---

# 53. SEARCH / FILTERING

Tables should support:

* Search
* Sort
* Pagination
* Date filters
* Branch filters
* Status filters
* Category filters

Create reusable:

```text
DataTable
FilterBar
SearchInput
Pagination
StatusBadge
```

components.

---

# 54. UI COMPONENT LIBRARY

Create reusable components:

```text
AppShell
Sidebar
Header
PageHeader
DataTable
FilterBar
SearchInput
StatCard
ChartCard
StatusBadge
EmptyState
ErrorState
LoadingState
ConfirmDialog
FormDrawer
FormModal
CurrencyDisplay
DateDisplay
BranchSelector
ProductSelector
CustomerSelector
SupplierSelector
PaymentSelector
TaxSummary
InvoicePreview
ReceiptPreview
```

---

# 55. CURRENCY

Use:

**ETB**

Create a centralized formatter:

```text
formatCurrency()
```

Do not scatter:

```text
ETB
```

formatting throughout components.

Prepare architecture for future multi-currency support but keep MVP focused on ETB.

---

# 56. DATE / NUMBER FORMATTING

Create centralized formatting utilities.

Do not hard-code date formats in individual screens.

Use consistent Ethiopian business-friendly formatting.

---

# 57. AUDIT LOG UI

Create:

```text
Administration
→ Audit Log
```

Show:

* User
* Action
* Entity
* Entity ID
* Branch
* Timestamp
* Description

Examples:

```text
Changed product price
Adjusted inventory
Cancelled invoice
Created purchase order
Changed user permission
```

Do not allow users to edit audit records.

---

# 58. NOTIFICATION CENTER

Create notifications for:

* Low stock
* Pending approvals
* Failed operations
* Stock transfer awaiting receipt
* New quotation
* Invoice status
* System notifications

Use mock notifications initially.

---

# 59. UX MICROINTERACTIONS

Add subtle animations:

* Page transitions
* Dropdown transitions
* Modal transitions
* Table row hover
* Button feedback
* Toast animation
* Skeleton loading

Do NOT add excessive parallax or cinematic animation.

This is business software.

Speed and usability are more important.

---

# 60. ARCHITECTURAL RULES FOR CURSOR HANDOFF

This is extremely important.

Write the application so that Cursor can later replace mock implementations with production implementations.

Use interfaces/services such as:

```text
AuthService
TenantService
ProductService
InventoryService
SalesService
PurchaseService
InvoiceService
PaymentService
TaxService
ReportService
PrinterService
BarcodeScannerService
CashDrawerService
FiscalAdapter
```

Do not put business logic directly inside UI components.

Bad:

```text
POSPage.tsx
→ calculates tax
→ updates inventory
→ creates invoice
→ records payment
```

Good:

```text
POSPage
    ↓
SalesService
    ↓
InventoryService
    ↓
InvoiceService
    ↓
PaymentService
```

The frontend should consume domain services.

---

# 61. MOCK API LAYER

If backend/database functionality is not available during implementation, create a clean mock repository/API layer.

Example:

```text
repositories/
services/
mocks/
types/
```

The UI must not depend on hard-coded arrays inside components.

Instead:

```text
Component
↓
Hook
↓
Service
↓
Repository
↓
Mock data
```

Later Cursor can replace:

```text
MockRepository
```

with:

```text
ApiRepository
```

without rewriting the UI.

---

# 62. STATE MANAGEMENT

Separate:

### Server state

Use TanStack Query.

### UI state

Use Zustand/local React state.

Do not put all application data into one global Zustand store.

Avoid unnecessary global state.

---

# 63. FORMS

Use:

```text
React Hook Form
+
Zod
```

for:

* Product
* Supplier
* Customer
* Purchase order
* Quotation
* Sales order
* Invoice
* Expense
* User
* Branch
* Tax settings

Show proper validation.

---

# 64. ROUTING

Create real routes.

Do not build everything as a single page with tabs.

Use route structure similar to:

```text
/dashboard

/pos

/sales
/sales/quotations
/sales/orders
/sales/invoices
/sales/returns

/inventory
/inventory/products
/inventory/products/[id]
/inventory/transfers
/inventory/counts
/inventory/adjustments

/purchases
/purchases/orders
/purchases/receiving
/purchases/suppliers

/customers

/expenses

/reports
/reports/sales
/reports/inventory
/reports/purchases
/reports/profit
/reports/tax

/settings
/settings/company
/settings/branches
/settings/users
/settings/roles
/settings/tax
/settings/invoices
/settings/payments
/settings/hardware
```

---

# 65. PAGE-LEVEL REQUIREMENTS

Every major page should include:

```text
Page Header
↓
Context / Filters
↓
Main Content
↓
Actions
```

Avoid unnecessary cards.

Use tables for operational data.

Use charts for trends.

Use forms for workflows.

---

# 66. EMPTY STATES

Examples:

Products:

```text
No products yet.

Add your first product to start managing inventory.

[ Add Product ]
```

Sales:

```text
No sales found for this period.
```

Quotations:

```text
No quotations found.

[ Create Quotation ]
```

---

# 67. IMPORT / EXPORT

Products:

```text
Import CSV
Export CSV
```

Customers:

```text
Import
Export
```

Reports:

```text
CSV
Excel
PDF
```

Create UI and validation preview.

---

# 68. DO NOT FAKE BACKEND FEATURES

Do not write UI that claims:

* "Connected to Ministry of Revenue"
* "Bank successfully verified"
* "Hardware connected"
* "Offline synchronization active"
* "Tax compliant"

unless that functionality actually exists.

For unfinished integrations say:

```text
Not configured
```

or:

```text
Integration ready
```

or:

```text
Coming in a future release
```

This distinction is essential.

---

# 69. DO NOT FAKE OFFLINE MODE

Create the architecture for offline POS.

Do not pretend the application has reliable offline synchronization yet.

You may create:

```text
Offline-ready architecture
```

and UI indicators/placeholders.

Cursor will later implement:

```text
IndexedDB
Sync Queue
Conflict Resolution
Idempotency
Background Sync
```

---

# 70. PERFORMANCE

Optimize for:

* Fast initial load
* Fast navigation
* Fast POS search
* Virtualized large tables where needed
* Debounced search
* Lazy-loaded reports
* Optimized images
* Minimal unnecessary re-renders

Assume some customers may have thousands of products.

Do not design a product table that only works with 20 records.

---

# 71. LARGE DATASETS

Tables should be designed for:

* 1,000+ products
* 10,000+ transactions
* large invoice history
* large inventory history

Use pagination.

Do not load entire datasets unnecessarily.

---

# 72. SECURITY FRONTEND REQUIREMENTS

Never trust frontend permission checks as the final security layer.

Frontend:

```text
Hide/disable unauthorized actions
```

Backend later:

```text
Actually enforce permissions
```

Structure the application so server-side authorization can be plugged in.

---

# 73. BUSINESS RULES TO REFLECT IN UI

### Sales

Cannot sell an inactive product.

### Inventory

Cannot arbitrarily edit historical stock transactions.

### Purchase receiving

Inventory increases only after receiving.

### Transfer

Destination stock updates after receiving.

### Invoice

Cancelled invoices remain in history.

### Returns

Return must reference an original sale where appropriate.

### Discounts

Permissions determine who can apply discounts.

### Price

Cashiers should not be able to change product prices unless explicitly permitted.

### Tax

Tax must come from centralized configuration.

---

# 74. NO CREDIT

Customer credit is NOT supported.

Do not create:

* Credit sales
* Receivables
* Customer balances
* Aging reports

The architecture may contain extension points, but the MVP UI must not expose credit functionality.

---

# 75. NO DELIVERY

Do not create delivery management.

Sales end at:

```text
Sale
→ Invoice
→ Payment
```

Future delivery can be added later.

---

# 76. NO PRINT/COPY SERVICES YET

Do not build:

* Copy jobs
* Print jobs
* Binding jobs
* Lamination jobs
* Service BOM
* Material reservation

But structure the inventory/service architecture so they can be added later.

---

# 77. NO BREAK-PACK

Do not build:

```text
Carton → Box → Pack → Piece
```

automatic decomposition.

UOM should remain modular and extensible only.

---

# 78. ETHIOPIAN LOCALIZATION

Use:

```text
ETB
```

as the default currency.

Architecture should support:

* TIN
* VAT status
* Tax categories
* Invoice numbers
* Ethiopian business information
* Bank payment recording
* Future Ethiopian fiscal adapter
* Future Amharic localization

Do not hard-code assumptions about specific tax rates.

Tax rates must be configurable.

---

# 79. SEED ACCOUNTS

Create development users:

```text
Owner:
owner@example.com

Manager:
manager@example.com

Cashier:
cashier@example.com

Storekeeper:
storekeeper@example.com

Accountant:
accountant@example.com
```

Use obvious development-only credentials and clearly mark them as development data.

Do not expose real credentials.

---

# 80. FINAL QUALITY STANDARD

Before considering the work complete, verify:

### Navigation

Every major navigation item works.

### CRUD

Products, customers, suppliers, branches and users have complete flows.

### Sales

POS works end-to-end using the mock repository.

### Wholesale

Quotation → Sales Order → Invoice works.

### Purchasing

PO → Receiving → Inventory works.

### Inventory

Stock → adjustment → transfer → count works.

### Payments

Cash and Bank recording work.

### Reports

Reports render realistic data.

### Permissions

Different roles see different capabilities.

### Forms

Validation works.

### Tables

Search/filter/sort/pagination work.

### Responsive

Desktop/tablet layouts work.

### Empty states

All major screens have them.

### Error states

All major screens have them.

### Loading states

All major screens have them.

### Printing

Receipt and invoice printable layouts work through browser printing.

### Hardware

Hardware adapter placeholders exist without fake integrations.

### Tax

Tax configuration is centralized and modular.

### Future modules

Feature flags/extension points exist.

---

# 81. IMPORTANT: DO NOT STOP AT A VISUAL MOCKUP

The result must be a **functional frontend application foundation**.

Do not merely generate:

* Static dashboard
* Decorative charts
* Fake buttons
* Dead navigation
* Screenshots disguised as application functionality

Buttons should perform meaningful frontend actions.

Forms should validate.

Dialogs should work.

Tables should filter.

POS should calculate totals.

Quotations should convert to orders.

Orders should convert to invoices.

Mock inventory should change when transactions occur.

Payment records should update invoice status.

Dashboard data should respond to seeded transaction changes where practical.

---

# 82. ARCHITECTURAL HANDOFF DOCUMENT

Create a file:

```text
/docs/CURSOR_HANDOFF.md
```

Document:

1. Architecture
2. Folder structure
3. Data model
4. Services
5. Repository pattern
6. Mock API layer
7. Authentication assumptions
8. Tenant architecture
9. Permission architecture
10. Inventory architecture
11. POS architecture
12. Hardware adapter interfaces
13. Fiscal adapter interfaces
14. Offline architecture placeholder
15. Known limitations
16. Heavy engineering tasks remaining
17. Recommended Cursor implementation order

Also create:

```text
/docs/ARCHITECTURE.md
/docs/DATABASE.md
/docs/ROADMAP.md
```

These documents must be useful to another engineer.

---

# 83. CURSOR'S FUTURE HEAVY WORK

Clearly document these as remaining engineering tasks:

### Backend

* NestJS API
* PostgreSQL
* Prisma
* Authentication
* RBAC enforcement
* Tenant isolation
* Transaction management

### Inventory

* Immutable inventory ledger
* Weighted average costing
* Atomic stock transactions
* Concurrency handling

### POS

* Offline IndexedDB
* Sync queue
* Idempotency
* Conflict resolution

### Hardware

* WebSerial
* WebUSB
* ESC/POS
* Printer integration
* Cash drawer

### Ethiopia

* Fiscal adapter
* MoR integration
* Electronic invoicing
* QR requirements
* Tax compliance verification

### Infrastructure

* Redis
* Background jobs
* Monitoring
* Logging
* Backups
* CI/CD
* Production deployment

---

# 84. FINAL INSTRUCTION

Build this as a serious foundation for a real SaaS product.

Prioritize:

1. Correct information architecture
2. Excellent UX
3. Complete workflows
4. Modular architecture
5. Reusable components
6. Realistic data
7. Clean TypeScript
8. Maintainability
9. Performance
10. Cursor handoff readiness

Do NOT reduce functionality merely because the backend is not being implemented yet.

Implement the complete user experience and frontend business logic.

Where functionality requires infrastructure that should be handled later by Cursor, create clean interfaces and explicit extension points rather than fake implementations.

The final result should feel like:

**A complete Ethiopian stationery business management application whose frontend and product architecture are ready for the heavy engineering phase.**

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/997478ea-79c6-4bb3-a51a-7dc61d236b93).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

/**
 * Core typed data model. Every business entity carries a `tenantId`:
 * the mock repository layer scopes all reads/writes by the active tenant so a
 * real API can enforce the same isolation server-side later.
 */

export type ID = string;

export interface TenantScoped {
  id: ID;
  tenantId: ID;
}

/* ------------------------------- Platform ------------------------------- */

export interface Tenant {
  id: ID;
  name: string;
  legalName: string;
  tin: string;
  vatRegistered: boolean;
  vatNumber?: string;
  phone: string;
  email: string;
  address: string;
  currency: "ETB";
  onboardingComplete: boolean;
  /** Approval status — new orgs start as "pending" until superadmin approves */
  plan?: "pending" | "trial" | "active" | "suspended";
  /** ISO date after which this org's access expires. null = no expiry. */
  expiresAt?: string | null;
  /** True once a superadmin has approved this organization */
  approved?: boolean;
}

export type RoleKey = "owner" | "manager" | "cashier" | "storekeeper" | "accountant" | "superadmin";

export interface Role {
  key: RoleKey;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface User extends TenantScoped {
  name: string;
  email: string;
  role: RoleKey;
  branchId: ID | null;
  status: "active" | "inactive";
  lastActiveAt: string;
  /** Password for authentication across devices. */
  password?: string;
  /** Development-only seeded credential. Never used in production. */
  devPassword?: string;
}

export type Permission =
  | "dashboard.view"
  | "pos.access"
  | "sales.view"
  | "sales.create"
  | "sales.edit"
  | "sales.return"
  | "sales.discount"
  | "quotations.view"
  | "quotations.create"
  | "quotations.edit"
  | "quotations.convert"
  | "orders.view"
  | "orders.create"
  | "orders.edit"
  | "orders.approve"
  | "invoices.view"
  | "invoices.create"
  | "invoices.cancel"
  | "products.view"
  | "products.create"
  | "products.edit"
  | "products.delete"
  | "products.price"
  | "inventory.view"
  | "inventory.adjust"
  | "inventory.transfer"
  | "inventory.receive"
  | "inventory.count"
  | "purchases.view"
  | "purchases.create"
  | "purchases.approve"
  | "purchases.receive"
  | "customers.view"
  | "customers.create"
  | "customers.edit"
  | "suppliers.view"
  | "suppliers.create"
  | "suppliers.edit"
  | "payments.view"
  | "payments.create"
  | "expenses.view"
  | "expenses.create"
  | "reports.sales"
  | "reports.inventory"
  | "reports.purchase"
  | "reports.profit"
  | "reports.tax"
  | "branches.manage"
  | "users.manage"
  | "roles.manage"
  | "audit.view"
  | "settings.manage"
  | "superadmin.view"
  | "orgs.manage"
  | "orgs.approve";

/* ------------------------------ Locations ------------------------------- */

export type LocationKind = "branch" | "warehouse";

export interface Branch extends TenantScoped {
  name: string;
  code: string;
  kind: LocationKind;
  address: string;
  phone: string;
  managerName: string;
  status: "active" | "inactive";
}

/* ------------------------------- Catalog -------------------------------- */

export interface Category extends TenantScoped {
  name: string;
}
export interface Brand extends TenantScoped {
  name: string;
}

export type UnitOfMeasure = "Piece" | "Pack" | "Box" | "Ream" | "Carton" | "Set";

export interface Product extends TenantScoped {
  sku: string;
  name: string;
  barcode: string;
  categoryId: ID;
  brandId: ID;
  description?: string;
  /** UOM stays modular: no automatic break-pack/decomposition in this phase. */
  unitOfMeasure: UnitOfMeasure;
  purchaseUnit: UnitOfMeasure;
  salesUnit: UnitOfMeasure;
  /** Reserved extension point for future package conversion rules. */
  conversionRules: Array<{ from: UnitOfMeasure; to: UnitOfMeasure; factor: number }>;
  cost: number;
  retailPrice: number;
  wholesalePrice: number;
  reorderLevel: number;
  taxCategoryId: ID;
  supplierId: ID | null;
  status: "active" | "archived";
}

/* ------------------------------ Inventory ------------------------------- */

export interface InventoryBalance extends TenantScoped {
  productId: ID;
  locationId: ID;
  quantity: number;
  averageCost: number;
}

export type InventoryTxnType =
  | "PURCHASE"
  | "SALE"
  | "RETURN"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "ADJUSTMENT"
  | "DAMAGE"
  | "SCRAP";

/** Append-only ledger. The UI never edits historical rows. */
export interface InventoryTransaction extends TenantScoped {
  productId: ID;
  locationId: ID;
  type: InventoryTxnType;
  quantity: number;
  unitCost: number;
  reference: string;
  userId: ID;
  createdAt: string;
  note?: string;
}

export type AdjustmentReason =
  | "Damage"
  | "Loss"
  | "Found stock"
  | "Counting correction"
  | "Other";

export interface InventoryAdjustment extends TenantScoped {
  productId: ID;
  locationId: ID;
  type: "increase" | "decrease";
  quantity: number;
  reason: AdjustmentReason;
  notes?: string;
  userId: ID;
  createdAt: string;
}

export type CountStatus = "Draft" | "Counting" | "Pending Approval" | "Approved" | "Cancelled";

export interface InventoryCountLine {
  productId: ID;
  systemQty: number;
  physicalQty: number | null;
}

export interface InventoryCount extends TenantScoped {
  reference: string;
  locationId: ID;
  status: CountStatus;
  lines: InventoryCountLine[];
  createdAt: string;
  createdBy: ID;
  approvedBy?: ID;
}

export type TransferStatus =
  | "Draft"
  | "Requested"
  | "Approved"
  | "In Transit"
  | "Received"
  | "Cancelled";

export interface InventoryTransfer extends TenantScoped {
  reference: string;
  fromLocationId: ID;
  toLocationId: ID;
  status: TransferStatus;
  lines: Array<{ productId: ID; quantity: number }>;
  createdAt: string;
  createdBy: ID;
}

/* ------------------------------ Purchasing ------------------------------ */

export interface Supplier extends TenantScoped {
  name: string;
  legalName: string;
  tin: string;
  vatNumber?: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  status: "active" | "inactive";
}

export type PurchaseOrderStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Partially Received"
  | "Received"
  | "Cancelled";

export interface PurchaseOrderItem {
  productId: ID;
  quantity: number;
  unitCost: number;
  receivedQty: number;
}

export interface PurchaseOrder extends TenantScoped {
  number: string;
  supplierId: ID;
  locationId: ID;
  date: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  notes?: string;
  createdBy: ID;
}

export interface GoodsReceipt extends TenantScoped {
  number: string;
  purchaseOrderId: ID;
  locationId: ID;
  date: string;
  items: Array<{ productId: ID; quantity: number; unitCost: number }>;
  receivedBy: ID;
  notes?: string;
}

/* ------------------------------- Customers ------------------------------ */

export type CustomerType =
  | "Individual"
  | "Business"
  | "School"
  | "NGO"
  | "Government"
  | "Other Organization";

export interface Customer extends TenantScoped {
  name: string;
  type: CustomerType;
  organization?: string;
  tin?: string;
  vatNumber?: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt: string;
}

/* --------------------------------- Sales -------------------------------- */

export interface DocumentLine {
  productId: ID;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxCategoryId: ID;
}

export type QuotationStatus =
  | "Draft"
  | "Sent"
  | "Accepted"
  | "Rejected"
  | "Expired"
  | "Converted";

export interface Quotation extends TenantScoped {
  number: string;
  customerId: ID;
  branchId: ID;
  date: string;
  validUntil: string;
  status: QuotationStatus;
  lines: DocumentLine[];
  terms?: string;
  notes?: string;
  createdBy: ID;
  salesOrderId?: ID;
}

export type SalesOrderStatus =
  | "Draft"
  | "Confirmed"
  | "Partially Fulfilled"
  | "Fulfilled"
  | "Cancelled";

export interface SalesOrder extends TenantScoped {
  number: string;
  customerId: ID;
  branchId: ID;
  date: string;
  status: SalesOrderStatus;
  lines: DocumentLine[];
  quotationId?: ID;
  invoiceId?: ID;
  notes?: string;
  createdBy: ID;
}

export type InvoiceStatus = "Draft" | "Issued" | "Paid" | "Partially Paid" | "Cancelled";

export interface Invoice extends TenantScoped {
  number: string;
  customerId: ID | null;
  branchId: ID;
  date: string;
  status: InvoiceStatus;
  lines: DocumentLine[];
  salesOrderId?: ID;
  saleId?: ID;
  notes?: string;
  cancelReason?: string;
  createdBy: ID;
}

export type SaleChannel = "retail" | "wholesale";

export interface Sale extends TenantScoped {
  number: string;
  branchId: ID;
  registerId: string;
  customerId: ID | null;
  channel: SaleChannel;
  lines: DocumentLine[];
  createdAt: string;
  cashierId: ID;
  invoiceId?: ID;
  status: "completed" | "held" | "returned";
}

export type ReturnReason =
  | "Customer return"
  | "Damaged"
  | "Wrong product"
  | "Duplicate"
  | "Other";

export interface SaleReturn extends TenantScoped {
  number: string;
  saleId: ID;
  branchId: ID;
  lines: Array<{ productId: ID; quantity: number; unitPrice: number }>;
  reason: ReturnReason;
  notes?: string;
  createdAt: string;
  createdBy: ID;
}

/* ------------------------------- Finance -------------------------------- */

export type PaymentMethod = "Cash" | "Bank";

export interface Payment extends TenantScoped {
  number: string;
  invoiceId: ID | null;
  saleId?: ID;
  branchId: ID;
  amount: number;
  method: PaymentMethod;
  bank?: string;
  reference?: string;
  receivedBy: ID;
  date: string;
}

export type ExpenseCategory =
  | "Rent"
  | "Utilities"
  | "Transport"
  | "Supplies"
  | "Maintenance"
  | "Salary"
  | "Other";

export interface Expense extends TenantScoped {
  date: string;
  category: ExpenseCategory;
  amount: number;
  method: PaymentMethod;
  branchId: ID;
  description: string;
  attachmentName?: string;
  recordedBy: ID;
}

export interface ShiftClosure extends TenantScoped {
  branchId: ID;
  registerId: string;
  cashierId: ID;
  openingBalance: number;
  cashSales: number;
  cashReturns: number;
  actualCash: number;
  closedAt: string;
  reviewedBy?: ID;
  notes?: string;
}

/* --------------------------------- Tax ---------------------------------- */

export interface TaxCategory extends TenantScoped {
  name: string;
  code: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo?: string;
  active: boolean;
}

export interface TaxConfiguration {
  pricesIncludeTax: boolean;
  defaultTaxCategoryId: ID;
  /** Fiscal integrations are declared but never implemented in this phase. */
  fiscalAdapter: "none" | "ethiopia";
  fiscalStatus: "not_configured";
}

/* ------------------------------- Audit ---------------------------------- */

export interface AuditLog extends TenantScoped {
  userId: ID;
  action: string;
  entity: string;
  entityId: ID;
  branchId: ID | null;
  description: string;
  createdAt: string;
}

export interface Notification extends TenantScoped {
  kind: "low_stock" | "approval" | "transfer" | "quotation" | "invoice" | "system";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

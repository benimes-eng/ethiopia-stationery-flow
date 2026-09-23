import type {
  AuditLog,
  Brand,
  Branch,
  Category,
  Customer,
  Expense,
  GoodsReceipt,
  ID,
  InventoryAdjustment,
  InventoryBalance,
  InventoryCount,
  InventoryTransaction,
  InventoryTransfer,
  Invoice,
  Notification,
  Payment,
  Product,
  PurchaseOrder,
  Quotation,
  Sale,
  SaleReturn,
  SalesOrder,
  ShiftClosure,
  Supplier,
  TaxCategory,
  TaxConfiguration,
  Tenant,
  User,
} from "@/domain/types";

export interface Database {
  tenants: Tenant[];
  users: User[];
  branches: Branch[];
  categories: Category[];
  brands: Brand[];
  products: Product[];
  balances: InventoryBalance[];
  ledger: InventoryTransaction[];
  adjustments: InventoryAdjustment[];
  counts: InventoryCount[];
  transfers: InventoryTransfer[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  customers: Customer[];
  quotations: Quotation[];
  salesOrders: SalesOrder[];
  sales: Sale[];
  returns: SaleReturn[];
  invoices: Invoice[];
  payments: Payment[];
  expenses: Expense[];
  shifts: ShiftClosure[];
  taxCategories: TaxCategory[];
  taxConfiguration: TaxConfiguration;
  audit: AuditLog[];
  notifications: Notification[];
  sequences: Record<string, number>;
}

const TENANT: ID = "tenant-abay";

export const DEV_PASSWORD = "demo1234";

/**
 * Clean Database builder with NO pre-seeded mock products or fake transactions.
 * Starts with empty products, balances, transactions, and customers.
 */
export function buildDatabase(): Database {
  const tenant: Tenant = {
    id: TENANT,
    name: "Stationery Management",
    legalName: "Stationery Management PLC",
    tin: "0012345678",
    vatRegistered: true,
    vatNumber: "VAT-0012345678",
    phone: "+251 11 552 3344",
    email: "operations@abaystationery.et",
    address: "Bole Road, Addis Ababa, Ethiopia",
    currency: "ETB",
    onboardingComplete: true,
    plan: "active",
    approved: true,
  };

  const branches: Branch[] = [
    {
      id: "loc-main-wh",
      tenantId: TENANT,
      name: "Main Warehouse",
      code: "WH-01",
      kind: "warehouse",
      address: "Kality Industrial Area, Addis Ababa",
      phone: "+251 11 442 1100",
      managerName: "Getachew Alemu",
      status: "active",
    },
    {
      id: "loc-store",
      tenantId: TENANT,
      name: "Main Store",
      code: "BR-01",
      kind: "branch",
      address: "Bole Road, Addis Ababa",
      phone: "+251 11 552 3344",
      managerName: "Hanna Tesfaye",
      status: "active",
    },
  ];

  const users: User[] = [
    {
      id: "user-owner",
      tenantId: TENANT,
      name: "Selam Abebe",
      email: "owner@example.com",
      role: "owner",
      branchId: null,
      status: "active",
      lastActiveAt: new Date().toISOString(),
      devPassword: DEV_PASSWORD,
    },
    {
      id: "user-manager",
      tenantId: TENANT,
      name: "Hanna Tesfaye",
      email: "manager@example.com",
      role: "manager",
      branchId: "loc-store",
      status: "active",
      lastActiveAt: new Date().toISOString(),
      devPassword: DEV_PASSWORD,
    },
    {
      id: "user-cashier",
      tenantId: TENANT,
      name: "Bereket Tadesse",
      email: "cashier@example.com",
      role: "cashier",
      branchId: "loc-store",
      status: "active",
      lastActiveAt: new Date().toISOString(),
      devPassword: DEV_PASSWORD,
    },
    {
      id: "user-store",
      tenantId: TENANT,
      name: "Getachew Alemu",
      email: "storekeeper@example.com",
      role: "storekeeper",
      branchId: "loc-main-wh",
      status: "active",
      lastActiveAt: new Date().toISOString(),
      devPassword: DEV_PASSWORD,
    },
    {
      id: "user-accountant",
      tenantId: TENANT,
      name: "Meron Haile",
      email: "accountant@example.com",
      role: "accountant",
      branchId: null,
      status: "active",
      lastActiveAt: new Date().toISOString(),
      devPassword: DEV_PASSWORD,
    },
  ];

  const taxCategories: TaxCategory[] = [
    { id: "tax-vat15", tenantId: TENANT, name: "Standard VAT", code: "VAT15", rate: 0.15, effectiveFrom: "2020-01-01", active: true },
    { id: "tax-zero", tenantId: TENANT, name: "Zero rated", code: "VAT0", rate: 0, effectiveFrom: "2020-01-01", active: true },
    { id: "tax-exempt", tenantId: TENANT, name: "Exempt", code: "EXEMPT", rate: 0, effectiveFrom: "2020-01-01", active: true },
  ];

  const taxConfiguration: TaxConfiguration = {
    pricesIncludeTax: false,
    defaultTaxCategoryId: "tax-vat15",
    fiscalAdapter: "none",
    fiscalStatus: "not_configured",
  };

  const categoryNames = [
    "Paper & Envelopes",
    "Writing Instruments",
    "Filing & Binders",
    "Office Machines & Electronics",
    "Art & Drawing",
    "Adhesives & Cutting",
    "Consumables & Accessories",
  ];
  const categories: Category[] = categoryNames.map((name, i) => ({ id: `cat-${i + 1}`, tenantId: TENANT, name }));

  const brandNames = ["Double A", "Bic", "Faber-Castell", "Deli", "Casio", "HP", "Generic", "Kores"];
  const brands: Brand[] = brandNames.map((name, i) => ({ id: `brand-${i + 1}`, tenantId: TENANT, name }));

  return {
    tenants: [tenant],
    users,
    branches,
    categories,
    brands,
    products: [],
    balances: [],
    ledger: [],
    adjustments: [],
    counts: [],
    transfers: [],
    suppliers: [],
    purchaseOrders: [],
    goodsReceipts: [],
    customers: [],
    quotations: [],
    salesOrders: [],
    sales: [],
    returns: [],
    invoices: [],
    payments: [],
    expenses: [],
    shifts: [],
    taxCategories,
    taxConfiguration,
    audit: [],
    notifications: [],
    sequences: { sale: 1, invoice: 1, payment: 1, quotation: 1, salesOrder: 1, purchaseOrder: 1, receipt: 1, transfer: 1, count: 1, return: 1 },
  };
}

export const SEED_TENANT_ID = TENANT;

export const SUPERADMIN_TENANT_ID = "tenant-platform";
export const SUPERADMIN_USERNAMES = ["admin", "superadmin", "superadmin@stationery.io"];
export const SUPERADMIN_PASSWORDS = ["admin", "admin1234", "SuperAdmin@2025"];

export const SUPERADMIN_EMAIL = "superadmin@stationery.io";
export const SUPERADMIN_PASSWORD = "admin";

/** The platform tenant that hosts the superadmin user */
export const PLATFORM_TENANT: Tenant = {
  id: SUPERADMIN_TENANT_ID,
  name: "Stationery Platform",
  legalName: "Stationery Management Platform",
  tin: "0000000000",
  vatRegistered: false,
  phone: "+251 90 000 0000",
  email: SUPERADMIN_EMAIL,
  address: "Addis Ababa, Ethiopia",
  currency: "ETB",
  onboardingComplete: true,
  plan: "active",
  approved: true,
};

/** The superadmin user (stored in cloud KV, not in regular tenant DB) */
export const PLATFORM_SUPERADMIN_USER: User = {
  id: "user-superadmin",
  tenantId: SUPERADMIN_TENANT_ID,
  name: "Super Admin",
  email: SUPERADMIN_EMAIL,
  role: "superadmin",
  branchId: null,
  status: "active",
  lastActiveAt: new Date().toISOString(),
  password: SUPERADMIN_PASSWORD,
};

export function buildTenantDatabase(tenant: Tenant, ownerUser: User, defaultBranch: Branch): Database {
  const taxCategories: TaxCategory[] = [
    {
      id: `tax-vat15-${tenant.id}`,
      tenantId: tenant.id,
      name: "Standard VAT",
      code: "VAT-15",
      rate: 0.15,
      active: true,
      appliesTo: "all",
    },
    {
      id: `tax-tot2-${tenant.id}`,
      tenantId: tenant.id,
      name: "Turnover Tax (TOT)",
      code: "TOT-2",
      rate: 0.02,
      active: true,
      appliesTo: "all",
    },
    {
      id: `tax-exempt-${tenant.id}`,
      tenantId: tenant.id,
      name: "Exempt Books & Educational",
      code: "EXEMPT",
      rate: 0.0,
      active: true,
      appliesTo: "all",
    },
  ];

  const taxConfiguration: TaxConfiguration = {
    id: `tax-cfg-${tenant.id}`,
    tenantId: tenant.id,
    vatRegistered: tenant.vatRegistered,
    vatNumber: tenant.vatNumber,
    defaultTaxCategoryId: taxCategories[0]!.id,
    pricesIncludeTax: true,
    fiscalPrinterEnabled: false,
    tinRequiredForInvoice: true,
    withholdingThreshold: 10000,
    withholdingRate: 0.02,
  };

  return {
    tenants: [tenant],
    users: [ownerUser],
    branches: [defaultBranch],
    categories: [],
    brands: [],
    products: [],
    balances: [],
    ledger: [],
    adjustments: [],
    counts: [],
    transfers: [],
    suppliers: [],
    purchaseOrders: [],
    goodsReceipts: [],
    customers: [],
    quotations: [],
    salesOrders: [],
    sales: [],
    returns: [],
    invoices: [],
    payments: [],
    expenses: [],
    shifts: [],
    taxCategories,
    taxConfiguration,
    audit: [],
    notifications: [],
    sequences: { sale: 1, invoice: 1, payment: 1, quotation: 1, salesOrder: 1, purchaseOrder: 1, receipt: 1, transfer: 1, count: 1, return: 1 },
  };
}

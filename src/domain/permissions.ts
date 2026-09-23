import type { Permission, Role, RoleKey } from "./types";

export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "pos.access",
  "sales.view",
  "sales.create",
  "sales.edit",
  "sales.return",
  "sales.discount",
  "quotations.view",
  "quotations.create",
  "quotations.edit",
  "quotations.convert",
  "orders.view",
  "orders.create",
  "orders.edit",
  "orders.approve",
  "invoices.view",
  "invoices.create",
  "invoices.cancel",
  "products.view",
  "products.create",
  "products.edit",
  "products.delete",
  "products.price",
  "inventory.view",
  "inventory.adjust",
  "inventory.transfer",
  "inventory.receive",
  "inventory.count",
  "purchases.view",
  "purchases.create",
  "purchases.approve",
  "purchases.receive",
  "customers.view",
  "customers.create",
  "customers.edit",
  "suppliers.view",
  "suppliers.create",
  "suppliers.edit",
  "payments.view",
  "payments.create",
  "expenses.view",
  "expenses.create",
  "reports.sales",
  "reports.inventory",
  "reports.purchase",
  "reports.profit",
  "reports.tax",
  "branches.manage",
  "users.manage",
  "roles.manage",
  "audit.view",
  "settings.manage",
  "superadmin.view",
  "orgs.manage",
  "orgs.approve",
];

export const PERMISSION_GROUPS: Array<{ label: string; permissions: Permission[] }> = [
  { label: "Overview", permissions: ["dashboard.view"] },
  {
    label: "Sales & POS",
    permissions: [
      "pos.access",
      "sales.view",
      "sales.create",
      "sales.edit",
      "sales.return",
      "sales.discount",
    ],
  },
  {
    label: "Wholesale documents",
    permissions: [
      "quotations.view",
      "quotations.create",
      "quotations.edit",
      "quotations.convert",
      "orders.view",
      "orders.create",
      "orders.edit",
      "orders.approve",
      "invoices.view",
      "invoices.create",
      "invoices.cancel",
    ],
  },
  {
    label: "Catalog",
    permissions: [
      "products.view",
      "products.create",
      "products.edit",
      "products.delete",
      "products.price",
    ],
  },
  {
    label: "Inventory",
    permissions: [
      "inventory.view",
      "inventory.adjust",
      "inventory.transfer",
      "inventory.receive",
      "inventory.count",
    ],
  },
  {
    label: "Purchasing",
    permissions: [
      "purchases.view",
      "purchases.create",
      "purchases.approve",
      "purchases.receive",
      "suppliers.view",
      "suppliers.create",
      "suppliers.edit",
    ],
  },
  { label: "Customers", permissions: ["customers.view", "customers.create", "customers.edit"] },
  {
    label: "Finance",
    permissions: ["payments.view", "payments.create", "expenses.view", "expenses.create"],
  },
  {
    label: "Reports",
    permissions: [
      "reports.sales",
      "reports.inventory",
      "reports.purchase",
      "reports.profit",
      "reports.tax",
    ],
  },
  {
    label: "Administration",
    permissions: ["branches.manage", "users.manage", "roles.manage", "audit.view", "settings.manage"],
  },
];

const managerPermissions: Permission[] = ALL_PERMISSIONS.filter(
  (p) => !["roles.manage", "users.manage", "settings.manage", "products.delete"].includes(p),
).concat(["users.manage"]);

const cashierPermissions: Permission[] = [
  "dashboard.view",
  "pos.access",
  "sales.view",
  "sales.create",
  "sales.return",
  "quotations.view",
  "invoices.view",
  "products.view",
  "inventory.view",
  "customers.view",
  "customers.create",
  "payments.view",
  "payments.create",
];

const storekeeperPermissions: Permission[] = [
  "dashboard.view",
  "products.view",
  "products.create",
  "products.edit",
  "inventory.view",
  "inventory.adjust",
  "inventory.transfer",
  "inventory.receive",
  "inventory.count",
  "purchases.view",
  "purchases.create",
  "purchases.receive",
  "suppliers.view",
  "suppliers.create",
  "reports.inventory",
  "reports.purchase",
];

const accountantPermissions: Permission[] = [
  "dashboard.view",
  "sales.view",
  "quotations.view",
  "orders.view",
  "invoices.view",
  "invoices.create",
  "invoices.cancel",
  "products.view",
  "inventory.view",
  "purchases.view",
  "purchases.approve",
  "suppliers.view",
  "customers.view",
  "payments.view",
  "payments.create",
  "expenses.view",
  "expenses.create",
  "reports.sales",
  "reports.inventory",
  "reports.purchase",
  "reports.profit",
  "reports.tax",
  "audit.view",
];

export const ROLES: Record<RoleKey, Role> = {
  owner: {
    key: "owner",
    name: "Owner",
    description: "Full access to every module, settings and administration.",
    permissions: ALL_PERMISSIONS,
  },
  manager: {
    key: "manager",
    name: "Manager",
    description: "Operational management across sales, inventory and purchasing.",
    permissions: managerPermissions,
  },
  cashier: {
    key: "cashier",
    name: "Cashier",
    description: "POS and counter sales operations.",
    permissions: cashierPermissions,
  },
  storekeeper: {
    key: "storekeeper",
    name: "Storekeeper",
    description: "Inventory, receiving, transfers and stock counts.",
    permissions: storekeeperPermissions,
  },
  accountant: {
    key: "accountant",
    name: "Accountant",
    description: "Invoices, payments, expenses and financial reporting.",
    permissions: accountantPermissions,
  },
  superadmin: {
    key: "superadmin",
    name: "Super Admin",
    description: "Platform administrator — manages all organizations, approvals, and access control.",
    permissions: ALL_PERMISSIONS,
  },
};

export const ROLE_KEYS: RoleKey[] = ["owner", "manager", "cashier", "storekeeper", "accountant", "superadmin"];

/**
 * Frontend permission check. This only hides/disables UI — the future backend
 * must enforce authorization independently.
 */
export function roleCan(role: RoleKey, permission: Permission): boolean {
  return ROLES[role].permissions.includes(permission);
}

import {
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/domain/types";

/** Literal union of every route the shell can link to. */
export type AppRoutePath =
  | "/"
  | "/pos"
  | "/sales"
  | "/returns"
  | "/quotations"
  | "/orders"
  | "/invoices"
  | "/products"
  | "/inventory"
  | "/purchasing"
  | "/suppliers"
  | "/customers"
  | "/payments"
  | "/expenses"
  | "/reports"
  | "/admin"
  | "/settings";

export interface NavItem {
  label: string;
  to: AppRoutePath;
  icon: LucideIcon;
  permission: Permission;
  description: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        to: "/",
        icon: LayoutDashboard,
        permission: "dashboard.view",
        description: "KPIs, trends and alerts",
      },
    ],
  },
  {
    label: "Selling",
    items: [
      {
        label: "Point of Sale",
        to: "/pos",
        icon: ShoppingCart,
        permission: "pos.access",
        description: "Register checkout",
      },
      {
        label: "Sales",
        to: "/sales",
        icon: Receipt,
        permission: "sales.view",
        description: "Completed and held sales",
      },
      {
        label: "Returns",
        to: "/returns",
        icon: RotateCcw,
        permission: "sales.return",
        description: "Sales returns and restocking",
      },
    ],
  },
  {
    label: "Wholesale documents",
    items: [
      {
        label: "Quotations",
        to: "/quotations",
        icon: FileText,
        permission: "quotations.view",
        description: "Offers to institutional buyers",
      },
      {
        label: "Sales orders",
        to: "/orders",
        icon: ClipboardList,
        permission: "orders.view",
        description: "Confirmed orders awaiting fulfilment",
      },
      {
        label: "Invoices",
        to: "/invoices",
        icon: FileText,
        permission: "invoices.view",
        description: "Issued invoices and balances",
      },
    ],
  },
  {
    label: "Stock",
    items: [
      {
        label: "Products",
        to: "/products",
        icon: Package,
        permission: "products.view",
        description: "Catalog, pricing and units",
      },
      {
        label: "Inventory",
        to: "/inventory",
        icon: Boxes,
        permission: "inventory.view",
        description: "Balances, adjustments, transfers, counts",
      },
      {
        label: "Purchasing",
        to: "/purchasing",
        icon: Truck,
        permission: "purchases.view",
        description: "Purchase orders and goods receiving",
      },
      {
        label: "Suppliers",
        to: "/suppliers",
        icon: Building2,
        permission: "suppliers.view",
        description: "Vendor master data",
      },
    ],
  },
  {
    label: "Relationships",
    items: [
      {
        label: "Customers",
        to: "/customers",
        icon: Users,
        permission: "customers.view",
        description: "Retail and institutional customers",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Payments",
        to: "/payments",
        icon: CreditCard,
        permission: "payments.view",
        description: "Cash and manual bank settlements",
      },
      {
        label: "Expenses",
        to: "/expenses",
        icon: Wallet,
        permission: "expenses.view",
        description: "Operating cost records",
      },
      {
        label: "Reports",
        to: "/reports",
        icon: BarChart3,
        permission: "reports.sales",
        description: "Sales, stock, purchase, profit and tax",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Administration",
        to: "/admin",
        icon: ShieldCheck,
        permission: "users.manage",
        description: "Branches, users, roles and audit trail",
      },
      {
        label: "Settings",
        to: "/settings",
        icon: Settings,
        permission: "settings.manage",
        description: "Business profile, tax, hardware, features",
      },
    ],
  },
];

export function visibleGroups(permissions: Permission[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);
}

export function allNavItems(): NavItem[] {
  return NAV_GROUPS.flatMap((g) => g.items);
}

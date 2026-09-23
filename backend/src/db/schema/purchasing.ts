import { pgTable, text, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { branches } from "./locations.js";
import { users } from "./users.js";

export const suppliers = pgTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    legalName: text("legal_name").notNull(),
    tin: text("tin").notNull(),
    vatNumber: text("vat_number"),
    contactName: text("contact_name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    address: text("address"),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantSupplierNameIdx: index("idx_suppliers_name").on(table.tenantId, table.name),
    tenantSupplierTinIdx: index("idx_suppliers_tin").on(table.tenantId, table.tin),
  })
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(), // e.g. "PO-1001"
    supplierId: text("supplier_id").notNull().references(() => suppliers.id, { onDelete: "restrict" }),
    locationId: text("location_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    expectedDate: timestamp("expected_date", { withTimezone: true }),
    status: text("status").notNull().default("Draft"), // 'Draft' | 'Pending Approval' | 'Approved' | 'Partially Received' | 'Received' | 'Cancelled'
    items: jsonb("items").notNull().default([]), // Array<{ productId, quantity, receivedQty, unitCost }>
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedBy: text("approved_by").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantPoNumberIdx: uniqueIndex("idx_po_tenant_number").on(table.tenantId, table.number),
    tenantPoStatusIdx: index("idx_po_status").on(table.tenantId, table.status),
  })
);

export const goodsReceipts = pgTable(
  "goods_receipts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(), // e.g. "GRN-1001"
    purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "restrict" }),
    locationId: text("location_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    items: jsonb("items").notNull().default([]), // Array<{ productId, quantity, unitCost }>
    notes: text("notes"),
    receivedBy: text("received_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantGrnNumberIdx: uniqueIndex("idx_grn_tenant_number").on(table.tenantId, table.number),
  })
);

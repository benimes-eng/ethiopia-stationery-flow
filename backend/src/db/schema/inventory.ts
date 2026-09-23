import { pgTable, text, numeric, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { branches } from "./locations.js";
import { products } from "./catalog.js";
import { users } from "./users.js";

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: text("id").primaryKey(), // e.g. "bal-prod01-locbole"
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    locationId: text("location_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull().default("0.00"),
    averageCost: numeric("average_cost", { precision: 14, scale: 2 }).notNull().default("0.00"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantProductLocationIdx: uniqueIndex("idx_balances_unique_loc").on(table.tenantId, table.productId, table.locationId),
    tenantLocationIdx: index("idx_balances_location").on(table.tenantId, table.locationId),
    tenantProductIdx: index("idx_balances_product").on(table.tenantId, table.productId),
  })
);

export const inventoryTransactions = pgTable(
  "inventory_transactions",
  {
    id: text("id").primaryKey(), // e.g. "itx-uuid"
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
    locationId: text("location_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    type: text("type").notNull(), // 'SALE' | 'PURCHASE' | 'SALES_RETURN' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'ADJUSTMENT' | 'DAMAGE' | 'STOCK_COUNT'
    quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(), // signed +/- delta
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull(),
    referenceType: text("reference_type").notNull(), // 'Sale' | 'PurchaseOrder' | 'Transfer' | 'Adjustment' | 'Count'
    referenceId: text("reference_id").notNull(),
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantLedgerIdx: index("idx_ledger_tenant_date").on(table.tenantId, table.createdAt),
    tenantProductLedgerIdx: index("idx_ledger_product").on(table.tenantId, table.productId, table.createdAt),
    tenantLocationLedgerIdx: index("idx_ledger_location").on(table.tenantId, table.locationId, table.createdAt),
  })
);

export const inventoryTransfers = pgTable(
  "inventory_transfers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(), // e.g. "TR-1001"
    fromLocationId: text("from_location_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    toLocationId: text("to_location_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("Requested"), // 'Draft' | 'Requested' | 'Approved' | 'In Transit' | 'Received' | 'Cancelled'
    lines: jsonb("lines").notNull().default([]), // Array<{ productId, quantity, unitCost }>
    notes: text("notes"),
    requestedBy: text("requested_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedBy: text("approved_by").references(() => users.id, { onDelete: "restrict" }),
    dispatchedBy: text("dispatched_by").references(() => users.id, { onDelete: "restrict" }),
    receivedBy: text("received_by").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantRefIdx: uniqueIndex("idx_transfers_tenant_ref").on(table.tenantId, table.reference),
    tenantStatusIdx: index("idx_transfers_status").on(table.tenantId, table.status),
  })
);

export const inventoryCounts = pgTable(
  "inventory_counts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(), // e.g. "CNT-1001"
    locationId: text("location_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("Counting"), // 'Counting' | 'Pending Approval' | 'Approved' | 'Cancelled'
    lines: jsonb("lines").notNull().default([]), // Array<{ productId, systemQty, physicalQty, variance }>
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    approvedBy: text("approved_by").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantCountRefIdx: uniqueIndex("idx_counts_tenant_ref").on(table.tenantId, table.reference),
  })
);

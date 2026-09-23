import { pgTable, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const branches = pgTable(
  "branches",
  {
    id: text("id").primaryKey(), // e.g. "loc-bole"
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(), // e.g. "BOL-01"
    kind: text("kind").notNull(), // 'branch' | 'warehouse'
    address: text("address").notNull(),
    phone: text("phone").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantBranchCodeIdx: uniqueIndex("idx_branches_tenant_code").on(table.tenantId, table.code),
    tenantStatusIdx: index("idx_branches_tenant_status").on(table.tenantId, table.status),
  })
);

export const posTerminals = pgTable(
  "pos_terminals",
  {
    id: text("id").primaryKey(), // e.g. "term-01"
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code").notNull(), // e.g. "REG-01"
    status: text("status").notNull().default("active"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantTerminalCodeIdx: uniqueIndex("idx_terminals_tenant_code").on(table.tenantId, table.branchId, table.code),
  })
);

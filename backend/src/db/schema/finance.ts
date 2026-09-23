import { pgTable, text, numeric, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { branches } from "./locations.js";
import { users } from "./users.js";
import { invoices } from "./sales.js";

export const payments = pgTable(
  "payments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(), // e.g. "PAY-1001"
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    method: text("method").notNull(), // 'Cash' | 'Bank'
    bank: text("bank"), // 'Commercial Bank of Ethiopia', 'Awash Bank', etc.
    reference: text("reference"), // Transaction/wire reference
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    receivedBy: text("received_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    idempotencyKey: text("idempotency_key"),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantPayNumberIdx: uniqueIndex("idx_payments_tenant_number").on(table.tenantId, table.number),
    tenantInvoicePaymentsIdx: index("idx_payments_invoice").on(table.tenantId, table.invoiceId),
    tenantPaymentIdempotencyIdx: uniqueIndex("idx_payments_idempotency").on(table.tenantId, table.idempotencyKey),
  })
);

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    category: text("category").notNull(), // 'Rent' | 'Utilities' | 'Transport' | 'Supplies' | 'Maintenance' | 'Salary' | 'Other'
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    method: text("method").notNull(), // 'Cash' | 'Bank'
    bank: text("bank"),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    description: text("description").notNull(),
    recordedBy: text("recorded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantExpenseDateIdx: index("idx_expenses_tenant_date").on(table.tenantId, table.date),
    tenantExpenseCatIdx: index("idx_expenses_category").on(table.tenantId, table.category),
    tenantExpenseBranchIdx: index("idx_expenses_branch").on(table.tenantId, table.branchId),
  })
);

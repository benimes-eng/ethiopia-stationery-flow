import { pgTable, text, numeric, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { branches } from "./locations.js";
import { users } from "./users.js";

export const customers = pgTable(
  "customers",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // 'Individual' | 'Business' | 'School' | 'NGO' | 'Government' | 'Other Organization'
    organization: text("organization"),
    tin: text("tin"),
    vatNumber: text("vat_number"),
    phone: text("phone").notNull(),
    email: text("email"),
    address: text("address"),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }).notNull().default("0.00"),
    currentBalance: numeric("current_balance", { precision: 14, scale: 2 }).notNull().default("0.00"),
    paymentTerms: text("payment_terms").notNull().default("Due on receipt"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantCustomerNameIdx: index("idx_customers_name").on(table.tenantId, table.name),
    tenantCustomerPhoneIdx: index("idx_customers_phone").on(table.tenantId, table.phone),
    tenantCustomerTinIdx: index("idx_customers_tin").on(table.tenantId, table.tin),
  })
);

export const quotations = pgTable(
  "quotations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(), // e.g. "QTN-1001"
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    validUntil: timestamp("valid_until", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("Draft"), // 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted'
    lines: jsonb("lines").notNull().default([]), // Array<DocumentLine>
    terms: text("terms"),
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantQuotationNumberIdx: uniqueIndex("idx_quotations_tenant_number").on(table.tenantId, table.number),
  })
);

export const salesOrders = pgTable(
  "sales_orders",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(), // e.g. "SO-1001"
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    quotationId: text("quotation_id").references(() => quotations.id, { onDelete: "set null" }),
    invoiceId: text("invoice_id"),
    date: timestamp("date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("Draft"), // 'Draft' | 'Confirmed' | 'Partially Fulfilled' | 'Fulfilled' | 'Cancelled'
    lines: jsonb("lines").notNull().default([]),
    notes: text("notes"),
    createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantOrderNumberIdx: uniqueIndex("idx_orders_tenant_number").on(table.tenantId, table.number),
  })
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(), // e.g. "INV-1001"
    customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    orderId: text("order_id").references(() => salesOrders.id, { onDelete: "set null" }),
    saleId: text("sale_id"),
    date: timestamp("date", { withTimezone: true }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    status: text("status").notNull().default("Issued"), // 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Cancelled'
    lines: jsonb("lines").notNull().default([]),
    notes: text("notes"),
    cancelReason: text("cancel_reason"),
    createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantInvoiceNumberIdx: uniqueIndex("idx_invoices_tenant_number").on(table.tenantId, table.number),
    tenantInvoiceStatusIdx: index("idx_invoices_status").on(table.tenantId, table.status),
    tenantCustomerInvoicesIdx: index("idx_invoices_customer").on(table.tenantId, table.customerId),
  })
);

export const sales = pgTable(
  "sales",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(), // e.g. "REC-1001"
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    registerId: text("register_id").notNull().default("REG-01"),
    cashierId: text("cashier_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    channel: text("channel").notNull().default("retail"), // 'retail' | 'wholesale'
    status: text("status").notNull().default("completed"), // 'completed' | 'held' | 'returned'
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
    discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0.00"),
    taxable: numeric("taxable", { precision: 14, scale: 2 }).notNull(),
    tax: numeric("tax", { precision: 14, scale: 2 }).notNull(),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    paymentMethod: text("payment_method").notNull(), // 'Cash' | 'Bank'
    lines: jsonb("lines").notNull().default([]),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantSaleNumberIdx: uniqueIndex("idx_sales_tenant_number").on(table.tenantId, table.number),
    tenantSaleDateIdx: index("idx_sales_tenant_date").on(table.tenantId, table.createdAt),
    tenantSaleIdempotencyIdx: uniqueIndex("idx_sales_idempotency").on(table.tenantId, table.idempotencyKey),
  })
);

export const saleReturns = pgTable(
  "sale_returns",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    number: text("number").notNull(), // e.g. "RET-1001"
    saleId: text("sale_id").notNull().references(() => sales.id, { onDelete: "restrict" }),
    branchId: text("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    cashierId: text("cashier_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
    lines: jsonb("lines").notNull().default([]), // Array<{ productId, quantity, unitPrice, returnReason }>
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    refundMethod: text("refund_method").notNull(), // 'Cash' | 'Bank' | 'Store Credit'
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantReturnNumberIdx: uniqueIndex("idx_returns_tenant_number").on(table.tenantId, table.number),
  })
);

import { pgTable, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(), // e.g. "tenant-abay"
  legalName: text("legal_name").notNull(),
  tradingName: text("trading_name").notNull(),
  tin: text("tin").notNull(), // Ethiopian Tax Identification Number
  vatNumber: text("vat_number"),
  vatRegistered: boolean("vat_registered").notNull().default(true),
  currency: text("currency").notNull().default("ETB"),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantSettings = pgTable("tenant_settings", {
  tenantId: text("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
  pricesIncludeTax: boolean("prices_include_tax").notNull().default(false),
  defaultTaxCategoryId: text("default_tax_category_id").notNull().default("tax-vat-15"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  receiptPrefix: text("receipt_prefix").notNull().default("REC-"),
  quotationPrefix: text("quotation_prefix").notNull().default("QTN-"),
  orderPrefix: text("order_prefix").notNull().default("SO-"),
  purchaseOrderPrefix: text("purchase_order_prefix").notNull().default("PO-"),
  goodsReceiptPrefix: text("goods_receipt_prefix").notNull().default("GRN-"),
  allowNegativeStock: boolean("allow_negative_stock").notNull().default(false),
  defaultPaymentTerms: text("default_payment_terms").notNull().default("Payment due within 15 days of issue."),
  receiptFooter: text("receipt_footer").notNull().default("Thank you for your business. Goods once sold are not returnable without receipt."),
  featureFlags: jsonb("feature_flags").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

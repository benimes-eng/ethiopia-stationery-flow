import { pgTable, text, numeric, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";

export const taxCategories = pgTable(
  "tax_categories",
  {
    id: text("id").primaryKey(), // e.g. "tax-vat-15"
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // "Standard VAT"
    code: text("code").notNull(), // "VAT-15"
    rate: numeric("rate", { precision: 5, scale: 4 }).notNull(), // 0.1500
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantTaxCodeIdx: index("idx_tax_categories_tenant").on(table.tenantId, table.code),
  })
);

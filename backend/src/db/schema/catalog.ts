import { pgTable, text, numeric, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { taxCategories } from "./tax.js";

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantCategoryCodeIdx: uniqueIndex("idx_categories_tenant_code").on(table.tenantId, table.code),
  })
);

export const brands = pgTable(
  "brands",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
    brandId: text("brand_id").references(() => brands.id, { onDelete: "set null" }),
    unitOfMeasure: text("unit_of_measure").notNull().default("Pcs"), // 'Pcs', 'Pkt', 'Box', 'Ream', 'Carton'
    cost: numeric("cost", { precision: 14, scale: 2 }).notNull().default("0.00"),
    retailPrice: numeric("retail_price", { precision: 14, scale: 2 }).notNull(),
    wholesalePrice: numeric("wholesale_price", { precision: 14, scale: 2 }).notNull(),
    reorderLevel: integer("reorder_level").notNull().default(10),
    taxCategoryId: text("tax_category_id").notNull().references(() => taxCategories.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("active"), // 'active' | 'archived'
    conversionRules: jsonb("conversion_rules").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantSkuIdx: uniqueIndex("idx_products_tenant_sku").on(table.tenantId, table.sku),
    tenantBarcodeIdx: index("idx_products_tenant_barcode").on(table.tenantId, table.barcode),
    tenantStatusIdx: index("idx_products_tenant_status").on(table.tenantId, table.status),
    tenantCategoryIdx: index("idx_products_tenant_cat").on(table.tenantId, table.categoryId),
  })
);

import { getActiveTenantId, db, delay, scoped } from "@/repositories/mock-repository";
import type { DocumentLine, ID, TaxCategory, TaxConfiguration } from "@/domain/types";

/**
 * TaxEngine — the single source of truth for tax math.
 * Components must never compute tax inline; rates are always configuration
 * driven so Ethiopian rate changes are a settings change, not a code change.
 */

export interface LineTotals {
  gross: number;
  discount: number;
  net: number;
  taxRate: number;
  tax: number;
  total: number;
}

export interface DocumentTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  byCategory: Array<{ categoryId: ID; name: string; rate: number; base: number; tax: number }>;
}

export const taxService = {
  categories(): TaxCategory[] {
    return this.listCategories();
  },
  listCategories(): TaxCategory[] {
    return scoped(db().taxCategories);
  },
  async getCategories() {
    return delay(this.listCategories());
  },
  getConfiguration(): TaxConfiguration {
    return db().taxConfiguration;
  },
  async updateConfiguration(patch: Partial<TaxConfiguration>) {
    Object.assign(db().taxConfiguration, patch);
    return delay(db().taxConfiguration);
  },
  async saveCategory(input: Omit<TaxCategory, "id" | "tenantId"> & { id?: ID }) {
    const data = db();
    if (input.id) {
      const existing = data.taxCategories.find((t) => t.id === input.id);
      if (existing) Object.assign(existing, input);
      return delay(existing!);
    }
    const created: TaxCategory = {
      ...input,
      id: `tax-${Math.random().toString(36).slice(2, 8)}`,
      tenantId: getActiveTenantId(),
    };
    data.taxCategories.push(created);
    return delay(created);
  },
  rateFor(categoryId: ID): number {
    const category = db().taxCategories.find((t) => t.id === categoryId);
    if (!category || !category.active) return 0;
    return category.rate;
  },
  computeLine(line?: Partial<DocumentLine> | null): LineTotals {
    if (!line) {
      return { gross: 0, discount: 0, net: 0, taxRate: 0, tax: 0, total: 0 };
    }
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unitPrice) || 0;
    const gross = qty * price;
    const discount = Math.min(Number(line.discount) || 0, gross);
    const net = gross - discount;
    const taxRate = line.taxCategoryId ? this.rateFor(line.taxCategoryId) : 0;
    const tax = Math.round(net * taxRate * 100) / 100;
    return { gross, discount, net, taxRate, tax, total: net + tax };
  },
  computeDocument(lines?: DocumentLine[] | null): DocumentTotals {
    const safeLines = Array.isArray(lines) ? lines : [];
    const categories = db().taxCategories;
    const byCategory = new Map<ID, { base: number; tax: number }>();
    let subtotal = 0;
    let discount = 0;
    let tax = 0;

    for (const line of safeLines) {
      const totals = this.computeLine(line);
      subtotal += totals.gross;
      discount += totals.discount;
      tax += totals.tax;
      if (line?.taxCategoryId) {
        const bucket = byCategory.get(line.taxCategoryId) ?? { base: 0, tax: 0 };
        bucket.base += totals.net;
        bucket.tax += totals.tax;
        byCategory.set(line.taxCategoryId, bucket);
      }
    }

    const taxable = subtotal - discount;
    return {
      subtotal: round(subtotal),
      discount: round(discount),
      taxable: round(taxable),
      tax: round(tax),
      total: round(taxable + tax),
      byCategory: [...byCategory.entries()].map(([categoryId, value]) => {
        const category = categories.find((c) => c.id === categoryId);
        return {
          categoryId,
          name: category?.name ?? "Unknown",
          rate: category?.rate ?? 0,
          base: round(value.base),
          tax: round(value.tax),
        };
      }),
    };
  },
};

function round(value: number) {
  return Math.round(value * 100) / 100;
}

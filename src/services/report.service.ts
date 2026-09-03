import { db, delay, scoped } from "@/repositories/mock-repository";
import { taxService } from "./tax.service";
import type { ID } from "@/domain/types";

/**
 * ReportService — all reporting aggregation lives here so the UI stays dumb.
 * A server-side reporting endpoint can replace these methods 1:1 later.
 */

export interface ReportRange {
  from: string;
  to: string;
  branchId: ID | "all";
}

function inRange(dateISO: string, range: ReportRange) {
  const d = dateISO.slice(0, 10);
  return d >= range.from && d <= range.to;
}

export function defaultRange(days = 30, branchId: ID | "all" = "all"): ReportRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), branchId };
}

export const reportService = {
  salesRows(range: ReportRange) {
    return scoped(db().sales).filter(
      (s) =>
        s.status === "completed" &&
        inRange(s.createdAt, range) &&
        (range.branchId === "all" || s.branchId === range.branchId),
    );
  },

  saleTotals(lines: Parameters<typeof taxService.computeDocument>[0]) {
    return taxService.computeDocument(lines);
  },

  cogsFor(lines: Array<{ productId: ID; quantity: number }>) {
    const products = db().products;
    return lines.reduce((sum, line) => {
      const cost = products.find((p) => p.id === line.productId)?.cost ?? 0;
      return sum + cost * line.quantity;
    }, 0);
  },

  async kpis(range: ReportRange) {
    const sales = this.salesRows(range);
    const today = new Date().toISOString().slice(0, 10);
    const todaySales = sales.filter((s) => s.createdAt.slice(0, 10) === today);
    const revenue = (rows: typeof sales) =>
      rows.reduce((s, sale) => s + this.saleTotals(sale.lines).total, 0);
    const cogs = sales.reduce((s, sale) => s + this.cogsFor(sale.lines), 0);
    const netSales = sales.reduce((s, sale) => s + this.saleTotals(sale.lines).taxable, 0);

    const balances = scoped(db().balances).filter(
      (b) => range.branchId === "all" || b.locationId === range.branchId,
    );
    const inventoryValue = balances.reduce((s, b) => s + b.quantity * b.averageCost, 0);
    const lowStock = balances.filter((b) => {
      const product = db().products.find((p) => p.id === b.productId);
      return product ? b.quantity <= product.reorderLevel && product.status === "active" : false;
    }).length;

    return delay({
      todaySales: revenue(todaySales),
      todayTransactions: todaySales.length,
      periodSales: revenue(sales),
      transactions: sales.length,
      grossProfit: netSales - cogs,
      grossMargin: netSales > 0 ? (netSales - cogs) / netSales : 0,
      inventoryValue,
      lowStock,
    });
  },

  async salesTrend(range: ReportRange) {
    const sales = this.salesRows(range);
    const buckets = new Map<string, number>();
    const start = new Date(range.from);
    const end = new Date(range.to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const sale of sales) {
      const key = sale.createdAt.slice(0, 10);
      buckets.set(key, (buckets.get(key) ?? 0) + this.saleTotals(sale.lines).total);
    }
    return delay([...buckets.entries()].map(([date, total]) => ({ date, total })));
  },

  async salesByBranch(range: ReportRange) {
    const branches = scoped(db().branches);
    const sales = this.salesRows({ ...range, branchId: "all" });
    return delay(
      branches
        .filter((b) => b.kind === "branch")
        .map((branch) => ({
          branch: branch.name,
          total: sales
            .filter((s) => s.branchId === branch.id)
            .reduce((s, sale) => s + this.saleTotals(sale.lines).total, 0),
        })),
    );
  },

  async salesByCashier(range: ReportRange) {
    const users = scoped(db().users);
    const sales = this.salesRows(range);
    return delay(
      users
        .filter((u) => sales.some((s) => s.cashierId === u.id))
        .map((user) => {
          const rows = sales.filter((s) => s.cashierId === user.id);
          return {
            cashier: user.name,
            transactions: rows.length,
            total: rows.reduce((s, sale) => s + this.saleTotals(sale.lines).total, 0),
          };
        }),
    );
  },

  async topProducts(range: ReportRange, limit = 8) {
    const sales = this.salesRows(range);
    const map = new Map<ID, { qty: number; revenue: number }>();
    for (const sale of sales) {
      for (const line of sale.lines) {
        const bucket = map.get(line.productId) ?? { qty: 0, revenue: 0 };
        bucket.qty += line.quantity;
        bucket.revenue += line.quantity * line.unitPrice - line.discount;
        map.set(line.productId, bucket);
      }
    }
    const products = db().products;
    return delay(
      [...map.entries()]
        .map(([productId, value]) => ({
          productId,
          name: products.find((p) => p.id === productId)?.name ?? "Unknown",
          sku: products.find((p) => p.id === productId)?.sku ?? "",
          ...value,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit),
    );
  },

  async salesByCategory(range: ReportRange) {
    const sales = this.salesRows(range);
    const categories = scoped(db().categories);
    const products = db().products;
    return delay(
      categories
        .map((category) => ({
          category: category.name,
          total: sales.reduce(
            (sum, sale) =>
              sum +
              sale.lines
                .filter((l) => products.find((p) => p.id === l.productId)?.categoryId === category.id)
                .reduce((s, l) => s + l.quantity * l.unitPrice - l.discount, 0),
            0,
          ),
        }))
        .filter((r) => r.total > 0),
    );
  },

  async purchaseTrend(range: ReportRange) {
    const receipts = scoped(db().goodsReceipts).filter((r) => inRange(r.date, range));
    const buckets = new Map<string, number>();
    for (const receipt of receipts) {
      const key = receipt.date.slice(0, 7);
      const total = receipt.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
      buckets.set(key, (buckets.get(key) ?? 0) + total);
    }
    return delay([...buckets.entries()].map(([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month)));
  },

  async purchasesBySupplier(range: ReportRange) {
    const suppliers = scoped(db().suppliers);
    const orders = scoped(db().purchaseOrders).filter((o) => inRange(o.date, range));
    return delay(
      suppliers
        .map((supplier) => {
          const rows = orders.filter((o) => o.supplierId === supplier.id);
          return {
            supplier: supplier.name,
            orders: rows.length,
            total: rows.reduce((s, o) => s + o.items.reduce((is, i) => is + i.quantity * i.unitCost, 0), 0),
          };
        })
        .filter((r) => r.orders > 0)
        .sort((a, b) => b.total - a.total),
    );
  },

  async profitability(range: ReportRange) {
    const sales = this.salesRows(range);
    const gross = sales.reduce((s, sale) => s + this.saleTotals(sale.lines).subtotal, 0);
    const discounts = sales.reduce((s, sale) => s + this.saleTotals(sale.lines).discount, 0);
    const net = gross - discounts;
    const cogs = sales.reduce((s, sale) => s + this.cogsFor(sale.lines), 0);
    const expenses = scoped(db().expenses)
      .filter((e) => inRange(e.date, range) && (range.branchId === "all" || e.branchId === range.branchId))
      .reduce((s, e) => s + e.amount, 0);
    return delay({
      gross,
      discounts,
      net,
      cogs,
      grossProfit: net - cogs,
      grossMargin: net > 0 ? (net - cogs) / net : 0,
      expenses,
      operatingProfit: net - cogs - expenses,
    });
  },

  async taxReport(range: ReportRange) {
    const invoices = scoped(db().invoices).filter(
      (i) =>
        i.status !== "Cancelled" &&
        inRange(i.date, range) &&
        (range.branchId === "all" || i.branchId === range.branchId),
    );
    const rows = invoices.map((invoice) => {
      const totals = taxService.computeDocument(invoice.lines);
      return {
        id: invoice.id,
        number: invoice.number,
        date: invoice.date,
        taxable: totals.taxable,
        tax: totals.tax,
        total: totals.total,
      };
    });
    return delay({
      rows,
      taxableTotal: rows.reduce((s, r) => s + r.taxable, 0),
      taxTotal: rows.reduce((s, r) => s + r.tax, 0),
      grandTotal: rows.reduce((s, r) => s + r.total, 0),
    });
  },

  async stockMovementReport(range: ReportRange) {
    return delay(
      scoped(db().ledger)
        .filter(
          (t) =>
            inRange(t.createdAt, range) && (range.branchId === "all" || t.locationId === range.branchId),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 300),
    );
  },
};

/** Frontend CSV export. Server-side Excel/PDF generation is a Cursor task. */
export function exportToCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const value = row[h];
          const text = value == null ? "" : String(value);
          return text.includes(",") ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

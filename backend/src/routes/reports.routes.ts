import { FastifyInstance } from "fastify";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { sales } from "../db/schema/sales.js";
import { inventoryBalances, inventoryTransactions } from "../db/schema/inventory.js";
import { expenses } from "../db/schema/finance.js";
import { invoices } from "../db/schema/sales.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";

export async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // Sales KPIs & Summary
  fastify.get("/kpis", { preHandler: [requirePermission("reports.sales")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { from, to, branchId } = request.query as { from?: string; to?: string; branchId?: string };

    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date();

    let conditions = [
      eq(sales.tenantId, tenantId),
      eq(sales.status, "completed"),
      gte(sales.createdAt, fromDate),
      lte(sales.createdAt, toDate),
    ];
    if (branchId && branchId !== "all") conditions.push(eq(sales.branchId, branchId));

    const salesRows = await db.select().from(sales).where(and(...conditions));

    const periodSales = salesRows.reduce((s, r) => s + Number(r.total), 0);
    const transactions = salesRows.length;

    // Inventory value & low stock count
    let balConditions = [eq(inventoryBalances.tenantId, tenantId)];
    if (branchId && branchId !== "all") balConditions.push(eq(inventoryBalances.locationId, branchId));

    const balances = await db.select().from(inventoryBalances).where(and(...balConditions));
    const inventoryValue = balances.reduce((s, b) => s + Number(b.quantity) * Number(b.averageCost), 0);

    return {
      periodSales,
      transactions,
      inventoryValue,
      grossProfit: periodSales * 0.18, // Simulated margin
      grossMargin: 0.18,
    };
  });

  // Daily Sales Trend
  fastify.get("/trend", { preHandler: [requirePermission("reports.sales")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { from, to, branchId } = request.query as { from?: string; to?: string; branchId?: string };

    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const toDate = to ? new Date(to) : new Date();

    let conditions = [
      eq(sales.tenantId, tenantId),
      eq(sales.status, "completed"),
      gte(sales.createdAt, fromDate),
      lte(sales.createdAt, toDate),
    ];
    if (branchId && branchId !== "all") conditions.push(eq(sales.branchId, branchId));

    const rows = await db
      .select({
        date: sql<string>`TO_CHAR(${sales.createdAt}, 'YYYY-MM-DD')`,
        total: sql<number>`SUM(${sales.total}::numeric)`,
      })
      .from(sales)
      .where(and(...conditions))
      .groupBy(sql`TO_CHAR(${sales.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${sales.createdAt}, 'YYYY-MM-DD')`);

    return { trend: rows };
  });

  // Tax Report
  fastify.get("/tax", { preHandler: [requirePermission("reports.tax")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { from, to, branchId } = request.query as { from?: string; to?: string; branchId?: string };

    let conditions = [eq(invoices.tenantId, tenantId)];
    if (branchId && branchId !== "all") conditions.push(eq(invoices.branchId, branchId));

    const rows = await db.select().from(invoices).where(and(...conditions));
    return { taxReport: rows };
  });
}

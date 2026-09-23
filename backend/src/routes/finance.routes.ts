import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { payments, expenses } from "../db/schema/finance.js";
import { invoices, customers } from "../db/schema/sales.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getNextSequenceNumber } from "../services/document-sequence.service.js";
import { serverTaxService } from "../services/tax.service.js";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema/index.js";

export async function financeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // CUSTOMERS CRM
  fastify.get("/customers", { preHandler: [requirePermission("customers.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const rows = await db.select().from(customers).where(eq(customers.tenantId, tenantId)).orderBy(customers.name);
    return { customers: rows };
  });

  fastify.post("/customers", { preHandler: [requirePermission("customers.create")] }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as any;

    const id = `cus-${Math.random().toString(36).slice(2, 10)}`;
    const newCus = {
      id,
      tenantId: user.tenantId,
      name: body.name,
      type: body.type || "Individual",
      organization: body.organization || null,
      tin: body.tin || null,
      vatNumber: body.vatNumber || null,
      phone: body.phone,
      email: body.email || null,
      address: body.address || null,
      creditLimit: body.creditLimit ? Number(body.creditLimit).toFixed(2) : "0.00",
    };

    await db.insert(customers).values(newCus);
    return reply.status(201).send({ customer: newCus });
  });

  // PAYMENTS
  fastify.get("/payments", { preHandler: [requirePermission("payments.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { branchId, method } = request.query as { branchId?: string; method?: string };
    let conditions = [eq(payments.tenantId, tenantId)];
    if (branchId && branchId !== "all") conditions.push(eq(payments.branchId, branchId));
    if (method && method !== "all") conditions.push(eq(payments.method, method));

    const rows = await db.select().from(payments).where(and(...conditions)).orderBy(desc(payments.createdAt));
    return { payments: rows };
  });

  // Record payment against invoice
  fastify.post("/payments", { preHandler: [requirePermission("payments.create")] }, async (request, reply) => {
    const user = request.user!;
    const { invoiceId, amount, method, bank, reference } = request.body as {
      invoiceId: string;
      amount: number;
      method: "Cash" | "Bank";
      bank?: string;
      reference?: string;
    };

    if (!invoiceId || amount <= 0) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invoice ID and positive amount required." } });
    }

    const inv = await db.select().from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, user.tenantId))).limit(1);
    if (!inv[0]) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Invoice not found." } });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tx = drizzle(client, { schema });

      const paymentNumber = await getNextSequenceNumber(user.tenantId, "Payment", "PAY-", tx as any);
      const paymentId = `pay-${Math.random().toString(36).slice(2, 10)}`;

      await tx.insert(payments).values({
        id: paymentId,
        tenantId: user.tenantId,
        number: paymentNumber,
        invoiceId,
        amount: amount.toFixed(2),
        method,
        bank: bank || null,
        reference: reference || null,
        branchId: inv[0].branchId,
        receivedBy: user.userId,
      });

      // Calculate total payments against this invoice
      const allPayments = await tx.select().from(payments).where(and(eq(payments.invoiceId, invoiceId), eq(payments.tenantId, user.tenantId)));
      const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount), 0);

      const invoiceLines = inv[0].lines as any[];
      const invoiceTotal = serverTaxService.computeDocument(invoiceLines).total;

      const newStatus = totalPaid + 0.01 >= invoiceTotal ? "Paid" : "Partially Paid";
      await tx.update(invoices).set({ status: newStatus, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));

      await client.query("COMMIT");
      return reply.status(201).send({ success: true, paymentNumber, invoiceStatus: newStatus });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });

  // EXPENSES
  fastify.get("/expenses", { preHandler: [requirePermission("expenses.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { category, branchId } = request.query as { category?: string; branchId?: string };
    let conditions = [eq(expenses.tenantId, tenantId)];
    if (category && category !== "all") conditions.push(eq(expenses.category, category));
    if (branchId && branchId !== "all") conditions.push(eq(expenses.branchId, branchId));

    const rows = await db.select().from(expenses).where(and(...conditions)).orderBy(desc(expenses.date));
    return { expenses: rows };
  });

  fastify.post("/expenses", { preHandler: [requirePermission("expenses.create")] }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as any;

    const id = `exp-${Math.random().toString(36).slice(2, 10)}`;
    const newExp = {
      id,
      tenantId: user.tenantId,
      date: new Date(body.date || Date.now()),
      category: body.category,
      amount: Number(body.amount).toFixed(2),
      method: body.method,
      bank: body.bank || null,
      branchId: body.branchId,
      description: body.description,
      recordedBy: user.userId,
    };

    await db.insert(expenses).values(newExp);
    return reply.status(201).send({ expense: newExp });
  });
}

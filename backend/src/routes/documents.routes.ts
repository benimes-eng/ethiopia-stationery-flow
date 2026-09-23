import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { quotations, salesOrders, invoices } from "../db/schema/sales.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getNextSequenceNumber } from "../services/document-sequence.service.js";

export async function documentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // QUOTATIONS
  fastify.get("/quotations", { preHandler: [requirePermission("quotations.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { status } = request.query as { status?: string };
    let conditions = [eq(quotations.tenantId, tenantId)];
    if (status && status !== "all") conditions.push(eq(quotations.status, status));

    const rows = await db.select().from(quotations).where(and(...conditions)).orderBy(desc(quotations.createdAt));
    return { quotations: rows };
  });

  fastify.post("/quotations", { preHandler: [requirePermission("quotations.create")] }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as any;

    const number = await getNextSequenceNumber(user.tenantId, "Quotation", "QTN-");
    const id = `qtn-${Math.random().toString(36).slice(2, 10)}`;

    const newQtn = {
      id,
      tenantId: user.tenantId,
      number,
      customerId: body.customerId,
      branchId: body.branchId,
      date: new Date(body.date || Date.now()),
      validUntil: new Date(body.validUntil),
      status: body.status || "Draft",
      lines: body.lines || [],
      terms: body.terms,
      notes: body.notes,
      createdBy: user.userId,
    };

    await db.insert(quotations).values(newQtn);
    return reply.status(201).send({ quotation: newQtn });
  });

  fastify.post("/quotations/:id/convert", { preHandler: [requirePermission("quotations.convert")] }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const qtn = await db.select().from(quotations).where(and(eq(quotations.id, id), eq(quotations.tenantId, user.tenantId))).limit(1);
    if (!qtn[0]) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Quotation not found." } });

    const orderNumber = await getNextSequenceNumber(user.tenantId, "Order", "SO-");
    const orderId = `so-${Math.random().toString(36).slice(2, 10)}`;

    const newOrder = {
      id: orderId,
      tenantId: user.tenantId,
      number: orderNumber,
      customerId: qtn[0].customerId,
      branchId: qtn[0].branchId,
      quotationId: qtn[0].id,
      date: new Date(),
      status: "Confirmed",
      lines: qtn[0].lines,
      notes: qtn[0].notes,
      createdBy: user.userId,
    };

    await db.insert(salesOrders).values(newOrder);
    await db.update(quotations).set({ status: "Converted", updatedAt: new Date() }).where(eq(quotations.id, id));

    return reply.status(201).send({ order: newOrder });
  });

  // SALES ORDERS
  fastify.get("/orders", { preHandler: [requirePermission("orders.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { status } = request.query as { status?: string };
    let conditions = [eq(salesOrders.tenantId, tenantId)];
    if (status && status !== "all") conditions.push(eq(salesOrders.status, status));

    const rows = await db.select().from(salesOrders).where(and(...conditions)).orderBy(desc(salesOrders.createdAt));
    return { orders: rows };
  });

  fastify.post("/orders/:id/convert", { preHandler: [requirePermission("invoices.create")] }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };

    const order = await db.select().from(salesOrders).where(and(eq(salesOrders.id, id), eq(salesOrders.tenantId, user.tenantId))).limit(1);
    if (!order[0]) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Sales order not found." } });

    const invoiceNumber = await getNextSequenceNumber(user.tenantId, "Invoice", "INV-");
    const invoiceId = `inv-${Math.random().toString(36).slice(2, 10)}`;

    const newInvoice = {
      id: invoiceId,
      tenantId: user.tenantId,
      number: invoiceNumber,
      customerId: order[0].customerId,
      branchId: order[0].branchId,
      orderId: order[0].id,
      date: new Date(),
      status: "Issued",
      lines: order[0].lines,
      notes: order[0].notes,
      createdBy: user.userId,
    };

    await db.insert(invoices).values(newInvoice);
    await db.update(salesOrders).set({ status: "Fulfilled", invoiceId, updatedAt: new Date() }).where(eq(salesOrders.id, id));

    return reply.status(201).send({ invoice: newInvoice });
  });

  // INVOICES
  fastify.get("/invoices", { preHandler: [requirePermission("invoices.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { status, branchId } = request.query as { status?: string; branchId?: string };
    let conditions = [eq(invoices.tenantId, tenantId)];
    if (status && status !== "all") conditions.push(eq(invoices.status, status));
    if (branchId && branchId !== "all") conditions.push(eq(invoices.branchId, branchId));

    const rows = await db.select().from(invoices).where(and(...conditions)).orderBy(desc(invoices.createdAt));
    return { invoices: rows };
  });

  fastify.post("/invoices/:id/cancel", { preHandler: [requirePermission("invoices.cancel")] }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const { reason } = request.body as { reason: string };

    const inv = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, user.tenantId))).limit(1);
    if (!inv[0]) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Invoice not found." } });

    if (inv[0].status === "Paid") {
      return reply.status(400).send({ error: { code: "CANNOT_CANCEL_PAID", message: "Paid invoices cannot be cancelled." } });
    }

    await db.update(invoices).set({ status: "Cancelled", cancelReason: reason, updatedAt: new Date() }).where(eq(invoices.id, id));
    return { success: true };
  });
}

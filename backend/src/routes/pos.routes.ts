import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { sales, saleReturns, invoices, payments } from "../db/schema/sales.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { checkIdempotency } from "../middleware/idempotency.js";
import { salesCheckoutService } from "../services/sales-checkout.service.js";
import { inventoryLedgerService } from "../services/inventory-ledger.service.js";
import { getNextSequenceNumber } from "../services/document-sequence.service.js";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema/index.js";

export async function posRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // POS Checkout (Atomic Transaction with Row Locks & Idempotency)
  fastify.post(
    "/checkout",
    {
      preHandler: [requirePermission("pos.access"), checkIdempotency],
    },
    async (request, reply) => {
      const user = request.user!;
      const body = request.body as any;
      const idempotencyKey = (request.headers["idempotency-key"] || request.headers["x-idempotency-key"]) as string | undefined;

      try {
        const result = await salesCheckoutService.processSale({
          tenantId: user.tenantId,
          branchId: body.branchId || user.branchId || "loc-bole",
          registerId: body.registerId || "REG-01",
          cashierId: user.userId,
          customerId: body.customerId || null,
          channel: body.channel || "retail",
          lines: body.lines,
          payment: body.payment,
          idempotencyKey,
        });

        // Store response in idempotency table if key provided
        if (idempotencyKey) {
          await db
            .update(schema.idempotencyKeys)
            .set({ responseStatus: 201, responseBody: result as any })
            .where(and(eq(schema.idempotencyKeys.tenantId, user.tenantId), eq(schema.idempotencyKeys.key, idempotencyKey)));
        }

        return reply.status(201).send(result);
      } catch (error: any) {
        if (error.name === "InsufficientStockError") {
          return reply.status(400).send({ error: { code: "INSUFFICIENT_STOCK", message: error.message } });
        }
        throw error;
      }
    }
  );

  // List sales history
  fastify.get("/sales", { preHandler: [requirePermission("sales.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { branchId, status } = request.query as { branchId?: string; status?: string };

    let conditions = [eq(sales.tenantId, tenantId)];
    if (branchId && branchId !== "all") conditions.push(eq(sales.branchId, branchId));
    if (status && status !== "all") conditions.push(eq(sales.status, status));

    const rows = await db
      .select()
      .from(sales)
      .where(and(...conditions))
      .orderBy(desc(sales.createdAt))
      .limit(100);

    return { sales: rows };
  });

  // Sales Return
  fastify.post("/returns", { preHandler: [requirePermission("sales.return")] }, async (request, reply) => {
    const user = request.user!;
    const { saleId, lines, refundMethod, reason } = request.body as any;

    const originalSale = await db
      .select()
      .from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.tenantId, user.tenantId)))
      .limit(1);

    if (!originalSale[0]) {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Original sale not found." } });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tx = drizzle(client, { schema });

      const returnNumber = await getNextSequenceNumber(user.tenantId, "Return", "RET-", tx as any);
      const returnId = `ret-${Math.random().toString(36).slice(2, 10)}`;

      let totalRefund = 0;
      for (const line of lines) {
        totalRefund += line.quantity * line.unitPrice;

        // Restock returned product to inventory
        await inventoryLedgerService.postTransaction(
          {
            tenantId: user.tenantId,
            productId: line.productId,
            locationId: originalSale[0].branchId,
            type: "SALES_RETURN",
            quantity: line.quantity, // Inbound restock
            unitCost: line.unitPrice,
            referenceType: "Sale",
            referenceId: returnNumber,
            notes: `Restocked return from ${originalSale[0].number}: ${reason}`,
            userId: user.userId,
          },
          tx as any
        );
      }

      await tx.insert(saleReturns).values({
        id: returnId,
        tenantId: user.tenantId,
        number: returnNumber,
        saleId,
        branchId: originalSale[0].branchId,
        cashierId: user.userId,
        customerId: originalSale[0].customerId,
        lines,
        total: totalRefund.toFixed(2),
        refundMethod,
        reason,
      });

      // Update original sale status
      await tx.update(sales).set({ status: "returned" }).where(eq(sales.id, saleId));

      await client.query("COMMIT");
      return reply.status(201).send({ success: true, returnNumber, returnId });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });
}

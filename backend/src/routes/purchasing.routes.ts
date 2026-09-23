import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { suppliers, purchaseOrders, goodsReceipts } from "../db/schema/purchasing.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { getNextSequenceNumber } from "../services/document-sequence.service.js";
import { inventoryLedgerService } from "../services/inventory-ledger.service.js";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema/index.js";

export async function purchasingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // SUPPLIERS
  fastify.get("/suppliers", { preHandler: [requirePermission("suppliers.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const rows = await db.select().from(suppliers).where(eq(suppliers.tenantId, tenantId)).orderBy(suppliers.name);
    return { suppliers: rows };
  });

  fastify.post("/suppliers", { preHandler: [requirePermission("suppliers.create")] }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as any;

    const id = `sup-${Math.random().toString(36).slice(2, 10)}`;
    const newSup = {
      id,
      tenantId: user.tenantId,
      name: body.name,
      legalName: body.legalName,
      tin: body.tin,
      vatNumber: body.vatNumber || null,
      contactName: body.contactName,
      phone: body.phone,
      email: body.email || null,
      address: body.address || null,
      notes: body.notes || null,
      status: body.status || "active",
    };

    await db.insert(suppliers).values(newSup);
    return reply.status(201).send({ supplier: newSup });
  });

  // PURCHASE ORDERS
  fastify.get("/orders", { preHandler: [requirePermission("purchases.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { status } = request.query as { status?: string };
    let conditions = [eq(purchaseOrders.tenantId, tenantId)];
    if (status && status !== "all") conditions.push(eq(purchaseOrders.status, status));

    const rows = await db.select().from(purchaseOrders).where(and(...conditions)).orderBy(desc(purchaseOrders.createdAt));
    return { orders: rows };
  });

  fastify.post("/orders", { preHandler: [requirePermission("purchases.create")] }, async (request, reply) => {
    const user = request.user!;
    const body = request.body as any;

    const number = await getNextSequenceNumber(user.tenantId, "PurchaseOrder", "PO-");
    const id = `po-${Math.random().toString(36).slice(2, 10)}`;

    const newPO = {
      id,
      tenantId: user.tenantId,
      number,
      supplierId: body.supplierId,
      locationId: body.locationId,
      date: new Date(),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      status: body.submitForApproval ? "Pending Approval" : "Draft",
      items: body.items || [],
      notes: body.notes,
      createdBy: user.userId,
    };

    await db.insert(purchaseOrders).values(newPO);
    return reply.status(201).send({ order: newPO });
  });

  // GOODS RECEIVING (GRN) - Increments inventory and recalculates average cost
  fastify.post("/receive", { preHandler: [requirePermission("purchases.receive")] }, async (request, reply) => {
    const user = request.user!;
    const { purchaseOrderId, lines, notes } = request.body as {
      purchaseOrderId: string;
      lines: Array<{ productId: string; quantity: number; unitCost: number }>;
      notes?: string;
    };

    const po = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, purchaseOrderId), eq(purchaseOrders.tenantId, user.tenantId))).limit(1);
    if (!po[0]) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Purchase order not found." } });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tx = drizzle(client, { schema });

      const grnNumber = await getNextSequenceNumber(user.tenantId, "GoodsReceipt", "GRN-", tx as any);
      const grnId = `grn-${Math.random().toString(36).slice(2, 10)}`;

      // Post each received item to the inventory ledger
      for (const line of lines) {
        await inventoryLedgerService.postTransaction(
          {
            tenantId: user.tenantId,
            productId: line.productId,
            locationId: po[0].locationId,
            type: "PURCHASE",
            quantity: line.quantity, // Inbound
            unitCost: line.unitCost,
            referenceType: "PurchaseOrder",
            referenceId: grnNumber,
            notes: `Received via ${grnNumber} against PO ${po[0].number}`,
            userId: user.userId,
          },
          tx as any
        );
      }

      // Record Goods Receipt Note
      await tx.insert(goodsReceipts).values({
        id: grnId,
        tenantId: user.tenantId,
        number: grnNumber,
        purchaseOrderId,
        locationId: po[0].locationId,
        date: new Date(),
        items: lines,
        notes,
        receivedBy: user.userId,
      });

      // Update PO status
      await tx.update(purchaseOrders).set({ status: "Received", updatedAt: new Date() }).where(eq(purchaseOrders.id, purchaseOrderId));

      await client.query("COMMIT");
      return reply.status(201).send({ success: true, grnNumber, grnId });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  });
}

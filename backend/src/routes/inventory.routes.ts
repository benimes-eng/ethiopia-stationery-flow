import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { inventoryBalances, inventoryTransactions, inventoryTransfers, inventoryCounts } from "../db/schema/inventory.js";
import { products } from "../db/schema/catalog.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { inventoryLedgerService } from "../services/inventory-ledger.service.js";
import { getNextSequenceNumber } from "../services/document-sequence.service.js";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema/index.js";

export async function inventoryRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // List stock balances
  fastify.get("/balances", { preHandler: [requirePermission("inventory.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { locationId, search } = request.query as { locationId?: string; search?: string };

    let conditions = [eq(inventoryBalances.tenantId, tenantId)];
    if (locationId && locationId !== "all") {
      conditions.push(eq(inventoryBalances.locationId, locationId));
    }

    const rows = await db
      .select({
        id: inventoryBalances.id,
        productId: inventoryBalances.productId,
        locationId: inventoryBalances.locationId,
        quantity: inventoryBalances.quantity,
        averageCost: inventoryBalances.averageCost,
        productName: products.name,
        sku: products.sku,
        cost: products.cost,
        retailPrice: products.retailPrice,
        reorderLevel: products.reorderLevel,
      })
      .from(inventoryBalances)
      .innerJoin(products, eq(inventoryBalances.productId, products.id))
      .where(and(...conditions));

    return { balances: rows };
  });

  // Get immutable ledger transactions
  fastify.get("/ledger", { preHandler: [requirePermission("inventory.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const { locationId, productId, type } = request.query as { locationId?: string; productId?: string; type?: string };

    let conditions = [eq(inventoryTransactions.tenantId, tenantId)];
    if (locationId && locationId !== "all") conditions.push(eq(inventoryTransactions.locationId, locationId));
    if (productId) conditions.push(eq(inventoryTransactions.productId, productId));
    if (type && type !== "all") conditions.push(eq(inventoryTransactions.type, type));

    const rows = await db
      .select()
      .from(inventoryTransactions)
      .where(and(...conditions))
      .orderBy(desc(inventoryTransactions.createdAt))
      .limit(300);

    return { ledger: rows };
  });

  // Manual Stock Adjustment
  fastify.post("/adjust", { preHandler: [requirePermission("inventory.adjust")] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const userId = request.user!.userId;
    const { productId, locationId, type, quantity, reason, notes } = request.body as {
      productId: string;
      locationId: string;
      type: "increase" | "decrease";
      quantity: number;
      reason: string;
      notes?: string;
    };

    if (!productId || !locationId || quantity <= 0) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Invalid adjustment parameters." } });
    }

    const prod = await db.select().from(products).where(and(eq(products.id, productId), eq(products.tenantId, tenantId))).limit(1);
    if (!prod[0]) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Product not found." } });

    const delta = type === "increase" ? quantity : -quantity;
    const adjTxType = type === "increase" ? "ADJUSTMENT" : reason === "Damage" ? "DAMAGE" : "ADJUSTMENT";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tx = drizzle(client, { schema });

      const adjNumber = await getNextSequenceNumber(tenantId, "Adjustment", "ADJ-", tx as any);

      const result = await inventoryLedgerService.postTransaction(
        {
          tenantId,
          productId,
          locationId,
          type: adjTxType as any,
          quantity: delta,
          unitCost: Number(prod[0].cost),
          referenceType: "Adjustment",
          referenceId: adjNumber,
          notes: `${reason}${notes ? ` — ${notes}` : ""}`,
          userId,
        },
        tx as any
      );

      await client.query("COMMIT");
      return reply.status(201).send({ success: true, adjustment: result });
    } catch (err: any) {
      await client.query("ROLLBACK");
      if (err.name === "InsufficientStockError") {
        return reply.status(400).send({ error: { code: "INSUFFICIENT_STOCK", message: err.message } });
      }
      throw err;
    } finally {
      client.release();
    }
  });

  // Stock Transfers
  fastify.get("/transfers", { preHandler: [requirePermission("inventory.transfer")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const rows = await db.select().from(inventoryTransfers).where(eq(inventoryTransfers.tenantId, tenantId)).orderBy(desc(inventoryTransfers.createdAt));
    return { transfers: rows };
  });

  fastify.post("/transfers", { preHandler: [requirePermission("inventory.transfer")] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const userId = request.user!.userId;
    const { fromLocationId, toLocationId, lines, notes } = request.body as any;

    if (fromLocationId === toLocationId) {
      return reply.status(400).send({ error: { code: "VALIDATION_ERROR", message: "Origin and destination locations must differ." } });
    }

    const ref = await getNextSequenceNumber(tenantId, "Transfer", "TR-");
    const transferId = `tr-${Math.random().toString(36).slice(2, 10)}`;

    await db.insert(inventoryTransfers).values({
      id: transferId,
      tenantId,
      reference: ref,
      fromLocationId,
      toLocationId,
      status: "Requested",
      lines: lines || [],
      notes,
      requestedBy: userId,
    });

    return reply.status(201).send({ success: true, reference: ref, id: transferId });
  });

  // Advance Transfer Status (e.g. In Transit -> Received)
  fastify.put("/transfers/:id/status", { preHandler: [requirePermission("inventory.transfer")] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const userId = request.user!.userId;
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    const tr = await db.select().from(inventoryTransfers).where(and(eq(inventoryTransfers.id, id), eq(inventoryTransfers.tenantId, tenantId))).limit(1);
    if (!tr[0]) return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Transfer not found." } });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tx = drizzle(client, { schema });

      const transferLines = tr[0].lines as Array<{ productId: string; quantity: number; unitCost?: number }>;

      // If advancing to "In Transit", stock leaves source location
      if (status === "In Transit") {
        for (const line of transferLines) {
          await inventoryLedgerService.postTransaction(
            {
              tenantId,
              productId: line.productId,
              locationId: tr[0].fromLocationId,
              type: "TRANSFER_OUT",
              quantity: -line.quantity,
              unitCost: line.unitCost || 0,
              referenceType: "Transfer",
              referenceId: tr[0].reference,
              userId,
            },
            tx as any
          );
        }
      }

      // If advancing to "Received", stock lands at destination location
      if (status === "Received") {
        for (const line of transferLines) {
          await inventoryLedgerService.postTransaction(
            {
              tenantId,
              productId: line.productId,
              locationId: tr[0].toLocationId,
              type: "TRANSFER_IN",
              quantity: line.quantity,
              unitCost: line.unitCost || 0,
              referenceType: "Transfer",
              referenceId: tr[0].reference,
              userId,
            },
            tx as any
          );
        }
      }

      await tx.update(inventoryTransfers).set({ status, updatedAt: new Date() }).where(eq(inventoryTransfers.id, id));
      await client.query("COMMIT");
      return { success: true };
    } catch (err: any) {
      await client.query("ROLLBACK");
      if (err.name === "InsufficientStockError") {
        return reply.status(400).send({ error: { code: "INSUFFICIENT_STOCK", message: err.message } });
      }
      throw err;
    } finally {
      client.release();
    }
  });

  // Stock Counts
  fastify.get("/counts", { preHandler: [requirePermission("inventory.count")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const rows = await db.select().from(inventoryCounts).where(eq(inventoryCounts.tenantId, tenantId)).orderBy(desc(inventoryCounts.createdAt));
    return { counts: rows };
  });
}

import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { inventoryBalances, inventoryTransactions } from "../db/schema/inventory.js";
import { tenantSettings } from "../db/schema/tenants.js";
import { products } from "../db/schema/catalog.js";

export interface PostLedgerInput {
  tenantId: string;
  productId: string;
  locationId: string;
  type: "SALE" | "PURCHASE" | "SALES_RETURN" | "TRANSFER_IN" | "TRANSFER_OUT" | "ADJUSTMENT" | "DAMAGE" | "STOCK_COUNT";
  quantity: number; // Signed delta: positive for inbound, negative for outbound
  unitCost: number;
  referenceType: "Sale" | "PurchaseOrder" | "Transfer" | "Adjustment" | "Count";
  referenceId: string;
  notes?: string;
  userId: string;
}

export class InsufficientStockError extends Error {
  constructor(productName: string, requested: number, available: number) {
    super(`Insufficient stock for '${productName}': requested ${requested}, but only ${available} available.`);
    this.name = "InsufficientStockError";
  }
}

export const inventoryLedgerService = {
  /**
   * Posts an append-only transaction to the ledger and updates balance atomically within a database transaction.
   */
  async postTransaction(input: PostLedgerInput, tx = db) {
    const { tenantId, productId, locationId, quantity, unitCost, type, referenceType, referenceId, notes, userId } = input;

    // 1. Lock the balance row using SELECT ... FOR UPDATE to serialize concurrent sales
    const balanceRows = await tx
      .select()
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.tenantId, tenantId),
          eq(inventoryBalances.productId, productId),
          eq(inventoryBalances.locationId, locationId)
        )
      )
      .for("update");

    let currentQty = 0;
    let currentAvgCost = unitCost;

    if (balanceRows.length > 0) {
      currentQty = Number(balanceRows[0]!.quantity);
      currentAvgCost = Number(balanceRows[0]!.averageCost);
    }

    const newQty = currentQty + quantity;

    // 2. Concurrency Safety: Check overselling if quantity is decreasing
    if (quantity < 0) {
      const settings = await tx
        .select({ allowNegative: tenantSettings.allowNegativeStock })
        .from(tenantSettings)
        .where(eq(tenantSettings.tenantId, tenantId))
        .limit(1);

      const allowNegative = settings[0]?.allowNegative ?? false;

      if (!allowNegative && newQty < 0) {
        // Fetch product name for friendly error message
        const prod = await tx
          .select({ name: products.name })
          .from(products)
          .where(and(eq(products.tenantId, tenantId), eq(products.id, productId)))
          .limit(1);

        throw new InsufficientStockError(prod[0]?.name ?? productId, Math.abs(quantity), currentQty);
      }
    }

    // 3. Weighted Average Cost (WAC) recalculation on inbound purchases
    let newAvgCost = currentAvgCost;
    if (quantity > 0 && (type === "PURCHASE" || type === "ADJUSTMENT")) {
      const totalCostBefore = currentQty > 0 ? currentQty * currentAvgCost : 0;
      const inboundCost = quantity * unitCost;
      const totalQtyAfter = currentQty > 0 ? currentQty + quantity : quantity;
      newAvgCost = totalQtyAfter > 0 ? (totalCostBefore + inboundCost) / totalQtyAfter : unitCost;
    }

    // 4. Update or insert inventory balance
    await tx
      .insert(inventoryBalances)
      .values({
        id: `bal-${productId}-${locationId}`,
        tenantId,
        productId,
        locationId,
        quantity: newQty.toFixed(2),
        averageCost: newAvgCost.toFixed(2),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [inventoryBalances.tenantId, inventoryBalances.productId, inventoryBalances.locationId],
        set: {
          quantity: newQty.toFixed(2),
          averageCost: newAvgCost.toFixed(2),
          updatedAt: new Date(),
        },
      });

    // 5. Append immutable entry to the ledger
    const ledgerTxId = `itx-${Math.random().toString(36).slice(2, 10)}`;
    await tx.insert(inventoryTransactions).values({
      id: ledgerTxId,
      tenantId,
      productId,
      locationId,
      type,
      quantity: quantity.toFixed(2),
      unitCost: unitCost.toFixed(2),
      referenceType,
      referenceId,
      notes,
      createdBy: userId,
      createdAt: new Date(),
    });

    return {
      transactionId: ledgerTxId,
      previousQuantity: currentQty,
      newQuantity: newQty,
      averageCost: newAvgCost,
    };
  },
};

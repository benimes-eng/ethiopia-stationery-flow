import {
  getActiveTenantId,
  db,
  delay,
  nextNumber,
  recordAudit,
  scoped,
  uid,
} from "@/repositories/mock-repository";
import type {
  AdjustmentReason,
  ID,
  InventoryBalance,
  InventoryCount,
  InventoryTransaction,
  InventoryTransfer,
  InventoryTxnType,
  Product,
} from "@/domain/types";

/**
 * InventoryService — owns every stock mutation.
 *
 * The ledger is append-only: balances are derived state, and no method here
 * edits a historical transaction. Weighted-average costing is simplified for
 * the mock layer and is a documented Cursor task.
 */

export interface StockRow {
  product: Product;
  locationId: ID;
  quantity: number;
  averageCost: number;
  retailValue: number;
  status: "In stock" | "Low stock" | "Out of stock";
}

function balanceOf(productId: ID, locationId: ID): InventoryBalance {
  const data = db();
  const activeTenant = getActiveTenantId();
  let balance = data.balances.find((b) => b.productId === productId && b.locationId === locationId && b.tenantId === activeTenant);
  if (!balance) {
    balance = {
      id: uid("bal"),
      tenantId: activeTenant,
      productId,
      locationId,
      quantity: 0,
      averageCost: data.products.find((p) => p.id === productId)?.cost ?? 0,
    };
    data.balances.push(balance);
  }
  return balance;
}

function post(txn: Omit<InventoryTransaction, "id" | "tenantId" | "createdAt">) {
  const data = db();
  const entry: InventoryTransaction = {
    ...txn,
    id: uid("txn"),
    tenantId: getActiveTenantId(),
    createdAt: new Date().toISOString(),
  };
  data.ledger.push(entry);
  const balance = balanceOf(txn.productId, txn.locationId);
  const incoming = txn.quantity > 0;
  if (incoming && txn.unitCost > 0) {
    const totalQty = balance.quantity + txn.quantity;
    balance.averageCost =
      totalQty > 0
        ? (balance.quantity * balance.averageCost + txn.quantity * txn.unitCost) / totalQty
        : txn.unitCost;
  }
  balance.quantity = Math.max(0, balance.quantity + txn.quantity);
  return entry;
}

export const inventoryService = {
  postTransaction(txn: Omit<InventoryTransaction, "id" | "tenantId" | "createdAt">) {
    return post(txn);
  },

  quantityAt(productId: ID, locationId: ID | "all") {
    const rows = scoped(db().balances).filter((b) => b.productId === productId);
    if (locationId === "all") return rows.reduce((s, b) => s + b.quantity, 0);
    return rows.find((b) => b.locationId === locationId)?.quantity ?? 0;
  },

  async stockRows(locationId: ID | "all", search = ""): Promise<StockRow[]> {
    const data = db();
    const products = scoped(data.products).filter((p) => p.status === "active");
    const q = search.trim().toLowerCase();
    const rows: StockRow[] = [];
    for (const product of products) {
      if (q && !product.name.toLowerCase().includes(q) && !product.sku.toLowerCase().includes(q))
        continue;
      const balances = scoped(data.balances).filter(
        (b) => b.productId === product.id && (locationId === "all" || b.locationId === locationId),
      );
      if (locationId === "all") {
        const quantity = balances.reduce((s, b) => s + b.quantity, 0);
        const averageCost = balances[0]?.averageCost ?? product.cost;
        rows.push({
          product,
          locationId: "all",
          quantity,
          averageCost,
          retailValue: quantity * product.retailPrice,
          status: statusFor(quantity, product.reorderLevel),
        });
      } else {
        for (const b of balances) {
          rows.push({
            product,
            locationId: b.locationId,
            quantity: b.quantity,
            averageCost: b.averageCost,
            retailValue: b.quantity * product.retailPrice,
            status: statusFor(b.quantity, product.reorderLevel),
          });
        }
      }
    }
    return delay(rows);
  },

  async summary(locationId: ID | "all") {
    const rows = await this.stockRows(locationId);
    const inventoryValue = rows.reduce((s, r) => s + r.quantity * r.averageCost, 0);
    return {
      skuCount: rows.length,
      units: rows.reduce((s, r) => s + r.quantity, 0),
      inventoryValue,
      retailValue: rows.reduce((s, r) => s + r.retailValue, 0),
      lowStock: rows.filter((r) => r.status === "Low stock").length,
      outOfStock: rows.filter((r) => r.status === "Out of stock").length,
    };
  },

  async lowStock(locationId: ID | "all", limit = 25) {
    const rows = await this.stockRows(locationId);
    return rows
      .filter((r) => r.status !== "In stock")
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, limit);
  },

  async ledger(filters: { productId?: ID; locationId?: ID | "all"; type?: InventoryTxnType | "all" } = {}) {
    let rows = scoped(db().ledger);
    if (filters.productId) rows = rows.filter((r) => r.productId === filters.productId);
    if (filters.locationId && filters.locationId !== "all")
      rows = rows.filter((r) => r.locationId === filters.locationId);
    if (filters.type && filters.type !== "all") rows = rows.filter((r) => r.type === filters.type);
    return delay([...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  /* ----------------------------- Adjustments ---------------------------- */
  async adjust(input: {
    productId: ID;
    locationId: ID;
    type: "increase" | "decrease";
    quantity: number;
    reason: AdjustmentReason;
    notes?: string;
    userId: ID;
  }) {
    const data = db();
    const before = this.quantityAt(input.productId, input.locationId);
    const signed = input.type === "increase" ? input.quantity : -input.quantity;
    const product = data.products.find((p) => p.id === input.productId)!;
    const txnType: InventoryTxnType =
      input.reason === "Damage" ? "DAMAGE" : input.type === "decrease" ? "ADJUSTMENT" : "ADJUSTMENT";
    post({
      productId: input.productId,
      locationId: input.locationId,
      type: txnType,
      quantity: signed,
      unitCost: product.cost,
      reference: `ADJ/${input.reason}`,
      userId: input.userId,
      note: input.notes,
    });
    data.adjustments.unshift({
      ...input,
      id: uid("adj"),
      tenantId: getActiveTenantId(),
      createdAt: new Date().toISOString(),
    });
    recordAudit({
      userId: input.userId,
      action: "Adjusted inventory",
      entity: "InventoryAdjustment",
      entityId: input.productId,
      branchId: input.locationId,
      description: `${input.type === "increase" ? "Increase" : "Decrease"} of ${input.quantity} units — ${input.reason}`,
    });
    return delay({ before, after: this.quantityAt(input.productId, input.locationId) });
  },

  adjustments() {
    return scoped(db().adjustments);
  },

  /* ------------------------------ Transfers ----------------------------- */
  transfers() {
    return scoped(db().transfers);
  },
  async listTransfers() {
    return delay([...this.transfers()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },
  async createTransfer(input: {
    fromLocationId: ID;
    toLocationId: ID;
    lines: Array<{ productId: ID; quantity: number }>;
    userId: ID;
    submit: boolean;
  }) {
    const transfer: InventoryTransfer = {
      id: uid("trf"),
      tenantId: getActiveTenantId(),
      reference: nextNumber("transfer", "TRF"),
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      status: input.submit ? "Requested" : "Draft",
      lines: input.lines,
      createdAt: new Date().toISOString(),
      createdBy: input.userId,
    };
    db().transfers.unshift(transfer);
    return delay(transfer);
  },
  /**
   * Transfer lifecycle. Stock leaves the source on dispatch and only lands at
   * the destination when it is received — never on dispatch.
   */
  async advanceTransfer(id: ID, next: InventoryTransfer["status"], userId: ID) {
    const transfer = db().transfers.find((t) => t.id === id);
    if (!transfer) throw new Error("Transfer not found.");
    if (next === "In Transit") {
      for (const line of transfer.lines) {
        const available = this.quantityAt(line.productId, transfer.fromLocationId);
        if (available < line.quantity)
          throw new Error("Insufficient stock at the source location to dispatch this transfer.");
      }
      for (const line of transfer.lines) {
        post({
          productId: line.productId,
          locationId: transfer.fromLocationId,
          type: "TRANSFER_OUT",
          quantity: -line.quantity,
          unitCost: 0,
          reference: transfer.reference,
          userId,
        });
      }
    }
    if (next === "Received") {
      for (const line of transfer.lines) {
        const product = db().products.find((p) => p.id === line.productId)!;
        post({
          productId: line.productId,
          locationId: transfer.toLocationId,
          type: "TRANSFER_IN",
          quantity: line.quantity,
          unitCost: product.cost,
          reference: transfer.reference,
          userId,
        });
      }
    }
    transfer.status = next;
    recordAudit({
      userId,
      action: `Transfer ${next.toLowerCase()}`,
      entity: "InventoryTransfer",
      entityId: transfer.id,
      branchId: transfer.fromLocationId,
      description: `${transfer.reference} moved to ${next}.`,
    });
    return delay(transfer);
  },

  /* -------------------------------- Counts ------------------------------ */
  counts() {
    return scoped(db().counts);
  },
  async listCounts() {
    return delay([...this.counts()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },
  async getCount(id: ID) {
    return delay(this.counts().find((c) => c.id === id) ?? null);
  },
  async createCount(locationId: ID, userId: ID) {
    const products = scoped(db().products).filter((p) => p.status === "active");
    const count: InventoryCount = {
      id: uid("cnt"),
      tenantId: getActiveTenantId(),
      reference: nextNumber("count", "SC"),
      locationId,
      status: "Counting",
      lines: products.map((p) => ({
        productId: p.id,
        systemQty: this.quantityAt(p.id, locationId),
        physicalQty: null,
      })),
      createdAt: new Date().toISOString(),
      createdBy: userId,
    };
    db().counts.unshift(count);
    return delay(count);
  },
  async saveCountLine(countId: ID, productId: ID, physicalQty: number | null) {
    const count = db().counts.find((c) => c.id === countId);
    const line = count?.lines.find((l) => l.productId === productId);
    if (line) line.physicalQty = physicalQty;
    return delay(count!);
  },
  async submitCount(countId: ID) {
    const count = db().counts.find((c) => c.id === countId);
    if (!count) throw new Error("Count not found.");
    count.status = "Pending Approval";
    return delay(count);
  },
  /** Manager approval converts variances into ledger adjustments. */
  async approveCount(countId: ID, userId: ID) {
    const count = db().counts.find((c) => c.id === countId);
    if (!count) throw new Error("Count not found.");
    for (const line of count.lines) {
      if (line.physicalQty === null) continue;
      const variance = line.physicalQty - line.systemQty;
      if (variance === 0) continue;
      const product = db().products.find((p) => p.id === line.productId)!;
      post({
        productId: line.productId,
        locationId: count.locationId,
        type: "ADJUSTMENT",
        quantity: variance,
        unitCost: product.cost,
        reference: count.reference,
        userId,
        note: "Stock count variance",
      });
    }
    count.status = "Approved";
    count.approvedBy = userId;
    recordAudit({
      userId,
      action: "Approved stock count",
      entity: "InventoryCount",
      entityId: count.id,
      branchId: count.locationId,
      description: `${count.reference} approved and posted to the ledger.`,
    });
    return delay(count);
  },
};

function statusFor(quantity: number, reorderLevel: number): StockRow["status"] {
  if (quantity <= 0) return "Out of stock";
  if (quantity <= reorderLevel) return "Low stock";
  return "In stock";
}

import {
  getActiveTenantId,
  db,
  delay,
  nextNumber,
  recordAudit,
  scoped,
  uid,
} from "@/repositories/mock-repository";
import { inventoryService } from "./inventory.service";
import type { GoodsReceipt, ID, PurchaseOrder, PurchaseOrderStatus } from "@/domain/types";

/**
 * PurchaseService — purchase orders and goods receiving.
 * Business rule: inventory increases only when goods are received, never when
 * an order is created or approved.
 */

export const purchasingService = {
  orders() {
    return scoped(db().purchaseOrders);
  },
  async listOrders(filters: { status?: PurchaseOrderStatus | "all"; search?: string } = {}) {
    let rows = this.orders();
    if (filters.status && filters.status !== "all") rows = rows.filter((o) => o.status === filters.status);
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter((o) => o.number.toLowerCase().includes(q));
    }
    return delay([...rows].sort((a, b) => b.date.localeCompare(a.date)));
  },
  async getOrder(id: ID) {
    return delay(this.orders().find((o) => o.id === id) ?? null);
  },
  total(order: PurchaseOrder) {
    return order.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
  },
  async saveOrder(input: {
    id?: ID;
    supplierId: ID;
    locationId: ID;
    expectedDate?: string;
    items: Array<{ productId: ID; quantity: number; unitCost: number }>;
    notes?: string;
    userId: ID;
    submitForApproval: boolean;
  }) {
    const data = db();
    if (input.id) {
      const existing = data.purchaseOrders.find((o) => o.id === input.id);
      if (!existing) throw new Error("Purchase order not found.");
      existing.supplierId = input.supplierId;
      existing.locationId = input.locationId;
      existing.expectedDate = input.expectedDate;
      existing.notes = input.notes;
      existing.items = input.items.map((i) => ({ ...i, receivedQty: 0 }));
      existing.status = input.submitForApproval ? "Pending Approval" : "Draft";
      return delay(existing);
    }
    const created: PurchaseOrder = {
      id: uid("po"),
      tenantId: getActiveTenantId(),
      number: nextNumber("purchaseOrder", "PO"),
      supplierId: input.supplierId,
      locationId: input.locationId,
      date: new Date().toISOString(),
      expectedDate: input.expectedDate,
      status: input.submitForApproval ? "Pending Approval" : "Draft",
      items: input.items.map((i) => ({ ...i, receivedQty: 0 })),
      notes: input.notes,
      createdBy: input.userId,
    };
    data.purchaseOrders.unshift(created);
    recordAudit({
      userId: input.userId,
      action: "Created purchase order",
      entity: "PurchaseOrder",
      entityId: created.id,
      branchId: created.locationId,
      description: `${created.number} created.`,
    });
    return delay(created);
  },
  async setOrderStatus(id: ID, status: PurchaseOrderStatus, userId: ID, reason?: string) {
    const order = db().purchaseOrders.find((o) => o.id === id);
    if (!order) throw new Error("Purchase order not found.");
    order.status = status;
    recordAudit({
      userId,
      action: `Purchase order ${status.toLowerCase()}`,
      entity: "PurchaseOrder",
      entityId: id,
      branchId: order.locationId,
      description: `${order.number} → ${status}${reason ? `. Reason: ${reason}` : ""}`,
    });
    return delay(order);
  },

  receipts() {
    return scoped(db().goodsReceipts);
  },
  async listReceipts() {
    return delay([...this.receipts()].sort((a, b) => b.date.localeCompare(a.date)));
  },
  receivable() {
    return this.orders().filter(
      (o) => o.status === "Approved" || o.status === "Partially Received",
    );
  },
  /** Partial receiving is supported; each receipt posts PURCHASE ledger rows. */
  async receive(input: {
    purchaseOrderId: ID;
    lines: Array<{ productId: ID; quantity: number; unitCost: number }>;
    userId: ID;
    notes?: string;
  }) {
    const data = db();
    const order = data.purchaseOrders.find((o) => o.id === input.purchaseOrderId);
    if (!order) throw new Error("Purchase order not found.");
    if (order.status !== "Approved" && order.status !== "Partially Received")
      throw new Error("Only approved purchase orders can be received.");
    const lines = input.lines.filter((l) => l.quantity > 0);
    if (lines.length === 0) throw new Error("Enter at least one received quantity.");

    for (const line of lines) {
      const item = order.items.find((i) => i.productId === line.productId);
      if (!item) continue;
      const remaining = item.quantity - item.receivedQty;
      if (line.quantity > remaining)
        throw new Error("Received quantity cannot exceed the remaining ordered quantity.");
      item.receivedQty += line.quantity;
      inventoryService.postTransaction({
        productId: line.productId,
        locationId: order.locationId,
        type: "PURCHASE",
        quantity: line.quantity,
        unitCost: line.unitCost,
        reference: order.number,
        userId: input.userId,
      });
    }

    const receipt: GoodsReceipt = {
      id: uid("grn"),
      tenantId: getActiveTenantId(),
      number: nextNumber("receipt", "GRN"),
      purchaseOrderId: order.id,
      locationId: order.locationId,
      date: new Date().toISOString(),
      items: lines,
      receivedBy: input.userId,
      notes: input.notes,
    };
    data.goodsReceipts.unshift(receipt);

    const fullyReceived = order.items.every((i) => i.receivedQty >= i.quantity);
    order.status = fullyReceived ? "Received" : "Partially Received";

    recordAudit({
      userId: input.userId,
      action: "Received goods",
      entity: "GoodsReceipt",
      entityId: receipt.id,
      branchId: order.locationId,
      description: `${receipt.number} received against ${order.number}.`,
    });
    return delay(receipt);
  },
};

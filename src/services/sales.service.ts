import {
  ACTIVE_TENANT_ID,
  db,
  delay,
  nextNumber,
  recordAudit,
  scoped,
  uid,
} from "@/repositories/mock-repository";
import { inventoryService } from "./inventory.service";
import { taxService } from "./tax.service";
import type {
  DocumentLine,
  ID,
  Invoice,
  Payment,
  PaymentMethod,
  ReturnReason,
  Sale,
  SaleReturn,
  ShiftClosure,
} from "@/domain/types";

/**
 * SalesService — POS checkout, holds, returns and shift closing.
 * It composes InventoryService (stock), InvoiceService (document) and
 * PaymentService (settlement); POS components never touch those directly.
 */

export interface CheckoutInput {
  branchId: ID;
  registerId: string;
  cashierId: ID;
  customerId: ID | null;
  channel: "retail" | "wholesale";
  lines: DocumentLine[];
  payment: { method: PaymentMethod; bank?: string; reference?: string; amount: number };
}

export interface CheckoutResult {
  sale: Sale;
  invoice: Invoice;
  payment: Payment;
  change: number;
}

export const ETHIOPIAN_BANKS = [
  "Commercial Bank of Ethiopia",
  "Awash Bank",
  "Dashen Bank",
  "Bank of Abyssinia",
  "Hibret Bank",
  "Other",
];

export const salesService = {
  sales() {
    return scoped(db().sales);
  },

  async listSales(filters: { branchId?: ID | "all"; search?: string; status?: Sale["status"] | "all" } = {}) {
    let rows = this.sales();
    if (filters.branchId && filters.branchId !== "all")
      rows = rows.filter((s) => s.branchId === filters.branchId);
    if (filters.status && filters.status !== "all") rows = rows.filter((s) => s.status === filters.status);
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter((s) => s.number.toLowerCase().includes(q));
    }
    return delay([...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },

  async getSale(id: ID) {
    return delay(this.sales().find((s) => s.id === id) ?? null);
  },

  /** Business rule: inactive products can never be sold. */
  assertSellable(lines: DocumentLine[]) {
    const products = db().products;
    for (const line of lines) {
      const product = products.find((p) => p.id === line.productId);
      if (!product || product.status !== "active")
        throw new Error(`${product?.name ?? "Product"} is not active and cannot be sold.`);
    }
  },

  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    if (input.lines.length === 0) throw new Error("Add at least one item before completing the sale.");
    this.assertSellable(input.lines);

    const totals = taxService.computeDocument(input.lines);
    if (input.payment.amount + 0.001 < totals.total)
      throw new Error("Payment amount is less than the sale total.");

    const data = db();
    const now = new Date().toISOString();
    const saleId = uid("sale");
    const invoiceId = uid("inv");

    const sale: Sale = {
      id: saleId,
      tenantId: ACTIVE_TENANT_ID,
      number: nextNumber("sale", "S"),
      branchId: input.branchId,
      registerId: input.registerId,
      customerId: input.customerId,
      channel: input.channel,
      lines: input.lines,
      createdAt: now,
      cashierId: input.cashierId,
      invoiceId,
      status: "completed",
    };

    const invoice: Invoice = {
      id: invoiceId,
      tenantId: ACTIVE_TENANT_ID,
      number: nextNumber("invoice", "INV"),
      customerId: input.customerId,
      branchId: input.branchId,
      date: now,
      status: "Paid",
      lines: input.lines,
      saleId,
      createdBy: input.cashierId,
    };

    const payment: Payment = {
      id: uid("pay"),
      tenantId: ACTIVE_TENANT_ID,
      number: nextNumber("payment", "PMT"),
      invoiceId,
      saleId,
      branchId: input.branchId,
      amount: totals.total,
      method: input.payment.method,
      bank: input.payment.bank,
      reference: input.payment.reference,
      receivedBy: input.cashierId,
      date: now,
    };

    data.sales.unshift(sale);
    data.invoices.unshift(invoice);
    data.payments.unshift(payment);

    for (const line of input.lines) {
      inventoryService.postTransaction({
        productId: line.productId,
        locationId: input.branchId,
        type: "SALE",
        quantity: -line.quantity,
        unitCost: 0,
        reference: sale.number,
        userId: input.cashierId,
      });
    }

    recordAudit({
      userId: input.cashierId,
      action: "Completed sale",
      entity: "Sale",
      entityId: sale.id,
      branchId: input.branchId,
      description: `${sale.number} settled by ${payment.method}.`,
    });

    return delay({
      sale,
      invoice,
      payment,
      change: Math.round((input.payment.amount - totals.total) * 100) / 100,
    });
  },

  /* --------------------------------- Holds ------------------------------- */
  async holdSale(input: Omit<CheckoutInput, "payment">) {
    const sale: Sale = {
      id: uid("sale"),
      tenantId: ACTIVE_TENANT_ID,
      number: nextNumber("sale", "H"),
      branchId: input.branchId,
      registerId: input.registerId,
      customerId: input.customerId,
      channel: input.channel,
      lines: input.lines,
      createdAt: new Date().toISOString(),
      cashierId: input.cashierId,
      status: "held",
    };
    db().sales.unshift(sale);
    return delay(sale);
  },
  heldSales(branchId: ID) {
    return this.sales().filter((s) => s.status === "held" && s.branchId === branchId);
  },
  async resumeSale(id: ID) {
    const data = db();
    const index = data.sales.findIndex((s) => s.id === id);
    if (index < 0) throw new Error("Held sale not found.");
    const [sale] = data.sales.splice(index, 1);
    return delay(sale!);
  },

  /* -------------------------------- Returns ------------------------------ */
  returns() {
    return scoped(db().returns);
  },
  async listReturns() {
    return delay([...this.returns()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },
  /** A return must always reference the original sale. */
  async createReturn(input: {
    saleId: ID;
    lines: Array<{ productId: ID; quantity: number; unitPrice: number }>;
    reason: ReturnReason;
    notes?: string;
    userId: ID;
    restock: boolean;
  }) {
    const sale = this.sales().find((s) => s.id === input.saleId);
    if (!sale) throw new Error("Original sale is required for a return.");
    if (input.lines.length === 0) throw new Error("Select at least one item to return.");

    const record: SaleReturn = {
      id: uid("ret"),
      tenantId: ACTIVE_TENANT_ID,
      number: nextNumber("return", "RTN"),
      saleId: sale.id,
      branchId: sale.branchId,
      lines: input.lines,
      reason: input.reason,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      createdBy: input.userId,
    };
    db().returns.unshift(record);

    for (const line of input.lines) {
      inventoryService.postTransaction({
        productId: line.productId,
        locationId: sale.branchId,
        type: input.restock ? "RETURN" : "DAMAGE",
        quantity: input.restock ? line.quantity : 0,
        unitCost: 0,
        reference: record.number,
        userId: input.userId,
        note: input.reason,
      });
    }

    recordAudit({
      userId: input.userId,
      action: "Recorded sales return",
      entity: "SaleReturn",
      entityId: record.id,
      branchId: sale.branchId,
      description: `${record.number} against ${sale.number} — ${input.reason}`,
    });
    return delay(record);
  },

  /* ------------------------------- Shifts -------------------------------- */
  shifts() {
    return scoped(db().shifts);
  },
  expectedCash(branchId: ID, cashierId: ID, openingBalance: number) {
    const today = new Date().toISOString().slice(0, 10);
    const payments = scoped(db().payments).filter(
      (p) =>
        p.branchId === branchId &&
        p.method === "Cash" &&
        p.receivedBy === cashierId &&
        p.date.slice(0, 10) === today,
    );
    const cashSales = payments.reduce((s, p) => s + p.amount, 0);
    const returnsToday = this.returns().filter(
      (r) => r.branchId === branchId && r.createdAt.slice(0, 10) === today,
    );
    const cashReturns = returnsToday.reduce(
      (s, r) => s + r.lines.reduce((ls, l) => ls + l.quantity * l.unitPrice, 0),
      0,
    );
    return {
      cashSales,
      cashReturns,
      expected: openingBalance + cashSales - cashReturns,
    };
  },
  async closeShift(input: Omit<ShiftClosure, "id" | "tenantId" | "closedAt">) {
    const closure: ShiftClosure = {
      ...input,
      id: uid("shift"),
      tenantId: ACTIVE_TENANT_ID,
      closedAt: new Date().toISOString(),
    };
    db().shifts.unshift(closure);
    recordAudit({
      userId: input.cashierId,
      action: "Closed register shift",
      entity: "ShiftClosure",
      entityId: closure.id,
      branchId: input.branchId,
      description: `Variance ${(input.actualCash - (input.openingBalance + input.cashSales - input.cashReturns)).toFixed(2)}`,
    });
    return delay(closure);
  },
};

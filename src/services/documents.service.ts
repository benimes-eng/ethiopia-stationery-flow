import {
  getActiveTenantId,
  db,
  delay,
  nextNumber,
  recordAudit,
  scoped,
  uid,
} from "@/repositories/mock-repository";
import { taxService } from "./tax.service";
import type {
  DocumentLine,
  ID,
  Invoice,
  Quotation,
  QuotationStatus,
  SalesOrder,
} from "@/domain/types";

/**
 * Quotation → Sales Order → Invoice pipeline.
 * Conversions always link documents so history stays traceable.
 */

export const documentsService = {
  /* ------------------------------ Quotations ----------------------------- */
  quotations() {
    return scoped(db().quotations);
  },
  async listQuotations(filters: { status?: QuotationStatus | "all"; search?: string } = {}) {
    let rows = this.quotations();
    if (filters.status && filters.status !== "all") rows = rows.filter((q) => q.status === filters.status);
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter((row) => row.number.toLowerCase().includes(q));
    }
    return delay([...rows].sort((a, b) => b.date.localeCompare(a.date)));
  },
  async getQuotation(id: ID) {
    return delay(this.quotations().find((q) => q.id === id) ?? null);
  },
  async saveQuotation(input: {
    id?: ID;
    customerId: ID;
    branchId: ID;
    validUntil: string;
    lines: DocumentLine[];
    terms?: string;
    notes?: string;
    userId: ID;
    status: QuotationStatus;
  }) {
    const data = db();
    if (input.id) {
      const existing = data.quotations.find((q) => q.id === input.id);
      if (!existing) throw new Error("Quotation not found.");
      Object.assign(existing, input);
      return delay(existing);
    }
    const created: Quotation = {
      id: uid("quo"),
      tenantId: getActiveTenantId(),
      number: nextNumber("quotation", "QT"),
      customerId: input.customerId,
      branchId: input.branchId,
      date: new Date().toISOString(),
      validUntil: input.validUntil,
      status: input.status,
      lines: input.lines,
      terms: input.terms,
      notes: input.notes,
      createdBy: input.userId,
    };
    data.quotations.unshift(created);
    return delay(created);
  },
  async setQuotationStatus(id: ID, status: QuotationStatus, userId: ID) {
    const quotation = db().quotations.find((q) => q.id === id);
    if (!quotation) throw new Error("Quotation not found.");
    quotation.status = status;
    recordAudit({
      userId,
      action: `Quotation ${status.toLowerCase()}`,
      entity: "Quotation",
      entityId: id,
      branchId: quotation.branchId,
      description: `${quotation.number} marked ${status}.`,
    });
    return delay(quotation);
  },
  async convertQuotationToOrder(id: ID, userId: ID) {
    const data = db();
    const quotation = data.quotations.find((q) => q.id === id);
    if (!quotation) throw new Error("Quotation not found.");
    if (quotation.status === "Converted") throw new Error("This quotation is already converted.");
    if (quotation.status !== "Accepted")
      throw new Error("Only accepted quotations can be converted to a sales order.");

    const order: SalesOrder = {
      id: uid("so"),
      tenantId: getActiveTenantId(),
      number: nextNumber("salesOrder", "SO"),
      customerId: quotation.customerId,
      branchId: quotation.branchId,
      date: new Date().toISOString(),
      status: "Confirmed",
      lines: quotation.lines,
      quotationId: quotation.id,
      createdBy: userId,
    };
    data.salesOrders.unshift(order);
    quotation.status = "Converted";
    quotation.salesOrderId = order.id;
    recordAudit({
      userId,
      action: "Converted quotation",
      entity: "SalesOrder",
      entityId: order.id,
      branchId: order.branchId,
      description: `${quotation.number} → ${order.number}`,
    });
    return delay(order);
  },

  /* ----------------------------- Sales orders --------------------------- */
  salesOrders() {
    return scoped(db().salesOrders);
  },
  async listSalesOrders(filters: { status?: SalesOrder["status"] | "all" } = {}) {
    let rows = this.salesOrders();
    if (filters.status && filters.status !== "all") rows = rows.filter((o) => o.status === filters.status);
    return delay([...rows].sort((a, b) => b.date.localeCompare(a.date)));
  },
  async getSalesOrder(id: ID) {
    return delay(this.salesOrders().find((o) => o.id === id) ?? null);
  },
  async setSalesOrderStatus(id: ID, status: SalesOrder["status"], userId: ID) {
    const order = db().salesOrders.find((o) => o.id === id);
    if (!order) throw new Error("Sales order not found.");
    order.status = status;
    recordAudit({
      userId,
      action: `Sales order ${status.toLowerCase()}`,
      entity: "SalesOrder",
      entityId: id,
      branchId: order.branchId,
      description: `${order.number} marked ${status}.`,
    });
    return delay(order);
  },
  async convertOrderToInvoice(id: ID, userId: ID) {
    const data = db();
    const order = data.salesOrders.find((o) => o.id === id);
    if (!order) throw new Error("Sales order not found.");
    if (order.invoiceId) throw new Error("This sales order already has an invoice.");
    if (order.status === "Draft") throw new Error("Confirm the sales order before invoicing.");

    const invoice: Invoice = {
      id: uid("inv"),
      tenantId: getActiveTenantId(),
      number: nextNumber("invoice", "INV"),
      customerId: order.customerId,
      branchId: order.branchId,
      date: new Date().toISOString(),
      status: "Issued",
      lines: order.lines,
      salesOrderId: order.id,
      createdBy: userId,
    };
    data.invoices.unshift(invoice);
    order.invoiceId = invoice.id;
    order.status = "Fulfilled";
    recordAudit({
      userId,
      action: "Issued invoice",
      entity: "Invoice",
      entityId: invoice.id,
      branchId: invoice.branchId,
      description: `${order.number} → ${invoice.number}`,
    });
    return delay(invoice);
  },

  /* -------------------------------- Invoices ---------------------------- */
  invoices() {
    return scoped(db().invoices);
  },
  async listInvoices(
    filters: { status?: Invoice["status"] | "all"; branchId?: ID | "all"; search?: string } = {},
  ) {
    let rows = this.invoices();
    if (filters.status && filters.status !== "all") rows = rows.filter((i) => i.status === filters.status);
    if (filters.branchId && filters.branchId !== "all")
      rows = rows.filter((i) => i.branchId === filters.branchId);
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter((i) => i.number.toLowerCase().includes(q));
    }
    return delay([...rows].sort((a, b) => b.date.localeCompare(a.date)));
  },
  async getInvoice(id: ID) {
    return delay(this.invoices().find((i) => i.id === id) ?? null);
  },
  totals(lines: DocumentLine[]) {
    return taxService.computeDocument(lines);
  },
  paidAmount(invoiceId: ID) {
    return scoped(db().payments)
      .filter((p) => p.invoiceId === invoiceId)
      .reduce((s, p) => s + p.amount, 0);
  },
  balance(invoice: Invoice) {
    return Math.round((this.totals(invoice.lines).total - this.paidAmount(invoice.id)) * 100) / 100;
  },
  /** Cancelled invoices stay in history — they are never deleted. */
  async cancelInvoice(id: ID, reason: string, userId: ID) {
    const invoice = db().invoices.find((i) => i.id === id);
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status === "Paid") throw new Error("A settled invoice cannot be cancelled.");
    invoice.status = "Cancelled";
    invoice.cancelReason = reason;
    recordAudit({
      userId,
      action: "Cancelled invoice",
      entity: "Invoice",
      entityId: id,
      branchId: invoice.branchId,
      description: `${invoice.number} cancelled. Reason: ${reason}`,
    });
    return delay(invoice);
  },
  async issueInvoice(id: ID, userId: ID) {
    const invoice = db().invoices.find((i) => i.id === id);
    if (!invoice) throw new Error("Invoice not found.");
    invoice.status = "Issued";
    recordAudit({
      userId,
      action: "Issued invoice",
      entity: "Invoice",
      entityId: id,
      branchId: invoice.branchId,
      description: `${invoice.number} issued.`,
    });
    return delay(invoice);
  },
};

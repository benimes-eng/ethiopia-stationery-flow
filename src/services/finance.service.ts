import {
  getActiveTenantId,
  db,
  delay,
  nextNumber,
  recordAudit,
  scoped,
  uid,
} from "@/repositories/mock-repository";
import { documentsService } from "./documents.service";
import type { Expense, ExpenseCategory, ID, Payment, PaymentMethod } from "@/domain/types";

/** PaymentService + ExpenseService. Cash and manually recorded bank payments only. */

export const financeService = {
  payments() {
    return scoped(db().payments);
  },
  async listPayments(filters: { method?: PaymentMethod | "all"; branchId?: ID | "all"; search?: string } = {}) {
    let rows = this.payments();
    if (filters.method && filters.method !== "all") rows = rows.filter((p) => p.method === filters.method);
    if (filters.branchId && filters.branchId !== "all")
      rows = rows.filter((p) => p.branchId === filters.branchId);
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter(
        (p) => p.number.toLowerCase().includes(q) || (p.reference ?? "").toLowerCase().includes(q),
      );
    }
    return delay([...rows].sort((a, b) => b.date.localeCompare(a.date)));
  },
  async getPayment(id: ID) {
    return delay(this.payments().find((p) => p.id === id) ?? null);
  },
  /** Recording a payment updates the invoice payment status. No bank API calls. */
  async recordPayment(input: {
    invoiceId: ID;
    amount: number;
    method: PaymentMethod;
    bank?: string;
    reference?: string;
    userId: ID;
  }) {
    const data = db();
    const invoice = data.invoices.find((i) => i.id === input.invoiceId);
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status === "Cancelled") throw new Error("A cancelled invoice cannot be settled.");
    if (input.amount <= 0) throw new Error("Amount must be greater than zero.");
    const balance = documentsService.balance(invoice);
    if (input.amount > balance + 0.01)
      throw new Error("Amount exceeds the outstanding invoice balance.");
    if (input.method === "Bank" && !input.reference)
      throw new Error("A bank reference is required for bank payments.");

    const payment: Payment = {
      id: uid("pay"),
      tenantId: getActiveTenantId(),
      number: nextNumber("payment", "PMT"),
      invoiceId: invoice.id,
      branchId: invoice.branchId,
      amount: input.amount,
      method: input.method,
      bank: input.bank,
      reference: input.reference,
      receivedBy: input.userId,
      date: new Date().toISOString(),
    };
    data.payments.unshift(payment);

    const paid = documentsService.paidAmount(invoice.id);
    const total = documentsService.totals(invoice.lines).total;
    invoice.status = paid + 0.01 >= total ? "Paid" : "Partially Paid";

    recordAudit({
      userId: input.userId,
      action: "Recorded payment",
      entity: "Payment",
      entityId: payment.id,
      branchId: invoice.branchId,
      description: `${payment.number} — ${payment.method} against ${invoice.number}.`,
    });
    return delay(payment);
  },

  expenses() {
    return scoped(db().expenses);
  },
  async listExpenses(filters: { category?: ExpenseCategory | "all"; branchId?: ID | "all" } = {}) {
    let rows = this.expenses();
    if (filters.category && filters.category !== "all")
      rows = rows.filter((e) => e.category === filters.category);
    if (filters.branchId && filters.branchId !== "all")
      rows = rows.filter((e) => e.branchId === filters.branchId);
    return delay([...rows].sort((a, b) => b.date.localeCompare(a.date)));
  },
  async saveExpense(input: Omit<Expense, "id" | "tenantId">) {
    const created: Expense = { ...input, id: uid("exp"), tenantId: getActiveTenantId() };
    db().expenses.unshift(created);
    recordAudit({
      userId: input.recordedBy,
      action: "Recorded expense",
      entity: "Expense",
      entityId: created.id,
      branchId: input.branchId,
      description: `${input.category} — ${input.amount}`,
    });
    return delay(created);
  },

  audit() {
    return scoped(db().audit);
  },
  async listAudit(search = "") {
    const q = search.trim().toLowerCase();
    const rows = this.audit().filter(
      (a) => !q || a.action.toLowerCase().includes(q) || a.description.toLowerCase().includes(q),
    );
    return delay([...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },
  notifications() {
    return scoped(db().notifications);
  },
  markNotificationsRead() {
    for (const n of this.notifications()) n.read = true;
  },
};

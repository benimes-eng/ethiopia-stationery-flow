import { pool, db } from "../db/client.js";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../db/schema/index.js";
import { inventoryLedgerService } from "./inventory-ledger.service.js";
import { getNextSequenceNumber } from "./document-sequence.service.js";
import { serverTaxService } from "./tax.service.js";

export interface CheckoutLine {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export interface CheckoutPayment {
  method: "Cash" | "Bank";
  bank?: string;
  reference?: string;
  amount: number;
}

export interface ProcessSaleInput {
  tenantId: string;
  branchId: string;
  registerId: string;
  cashierId: string;
  customerId?: string | null;
  channel: "retail" | "wholesale";
  lines: CheckoutLine[];
  payment: CheckoutPayment;
  idempotencyKey?: string;
}

export const salesCheckoutService = {
  async processSale(input: ProcessSaleInput) {
    const { tenantId, branchId, registerId, cashierId, customerId, channel, lines, payment, idempotencyKey } = input;

    if (!lines || lines.length === 0) {
      throw new Error("Cannot checkout empty cart. At least one line item is required.");
    }

    for (const l of lines) {
      if (l.quantity <= 0) throw new Error(`Invalid line quantity: ${l.quantity}. Must be > 0.`);
      if (l.unitPrice < 0) throw new Error(`Invalid unit price: ${l.unitPrice}. Must be >= 0.`);
    }

    // Compute totals server-side
    const totals = serverTaxService.computeDocument(lines);
    if (payment.amount + 0.001 < totals.total) {
      throw new Error(`Insufficient payment amount: received ${payment.amount}, expected ${totals.total}`);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);

      const tx = drizzle(client, { schema });

      // 1. Generate collision-free sequence numbers
      const receiptNumber = await getNextSequenceNumber(tenantId, "Receipt", "REC-", tx as any);
      const invoiceNumber = await getNextSequenceNumber(tenantId, "Invoice", "INV-", tx as any);
      const paymentNumber = await getNextSequenceNumber(tenantId, "Payment", "PAY-", tx as any);

      const saleId = `sale-${Math.random().toString(36).slice(2, 10)}`;
      const invoiceId = `inv-${Math.random().toString(36).slice(2, 10)}`;
      const paymentId = `pay-${Math.random().toString(36).slice(2, 10)}`;
      const now = new Date();

      // 2. Concurrency-Safe Inventory Deductions
      for (const line of lines) {
        // Fetch product cost for ledger valuation
        const prod = await tx
          .select({ cost: schema.products.cost, name: schema.products.name, status: schema.products.status })
          .from(schema.products)
          .where(schema.eq(schema.products.id, line.productId))
          .limit(1);

        if (!prod[0] || prod[0].status !== "active") {
          throw new Error(`Product '${prod[0]?.name ?? line.productId}' is archived or inactive and cannot be sold.`);
        }

        const unitCost = Number(prod[0].cost);

        // Deduct inventory atomically with row lock
        await inventoryLedgerService.postTransaction(
          {
            tenantId,
            productId: line.productId,
            locationId: branchId,
            type: "SALE",
            quantity: -line.quantity, // Outbound
            unitCost,
            referenceType: "Sale",
            referenceId: saleId,
            notes: `Sold via ${receiptNumber} on ${registerId}`,
            userId: cashierId,
          },
          tx as any
        );
      }

      // 3. Create Invoice Record
      await tx.insert(schema.invoices).values({
        id: invoiceId,
        tenantId,
        number: invoiceNumber,
        customerId: customerId || "cus-walkin",
        branchId,
        saleId,
        date: now,
        status: "Paid",
        lines: lines as any,
        createdBy: cashierId,
        createdAt: now,
      });

      // 4. Create Sale Record
      await tx.insert(schema.sales).values({
        id: saleId,
        tenantId,
        number: receiptNumber,
        branchId,
        registerId,
        cashierId,
        customerId: customerId || null,
        channel,
        status: "completed",
        subtotal: totals.subtotal.toFixed(2),
        discount: totals.discount.toFixed(2),
        taxable: totals.taxable.toFixed(2),
        tax: totals.tax.toFixed(2),
        total: totals.total.toFixed(2),
        paymentMethod: payment.method,
        lines: lines as any,
        invoiceId,
        idempotencyKey: idempotencyKey || null,
        createdAt: now,
      });

      // 5. Create Payment Record
      await tx.insert(schema.payments).values({
        id: paymentId,
        tenantId,
        number: paymentNumber,
        invoiceId,
        amount: totals.total.toFixed(2),
        method: payment.method,
        bank: payment.bank || null,
        reference: payment.reference || null,
        branchId,
        receivedBy: cashierId,
        idempotencyKey: idempotencyKey ? `${idempotencyKey}-pay` : null,
        date: now,
        createdAt: now,
      });

      // 6. Record Audit Log
      await tx.insert(schema.auditLogs).values({
        id: `aud-${Math.random().toString(36).slice(2, 10)}`,
        tenantId,
        userId: cashierId,
        action: "SALE_COMPLETED",
        entity: "Sale",
        entityId: saleId,
        branchId,
        description: `Sale ${receiptNumber} completed for ${totals.total} ETB via ${payment.method}.`,
        createdAt: now,
      });

      await client.query("COMMIT");

      return {
        saleId,
        receiptNumber,
        invoiceNumber,
        paymentNumber,
        totals,
        change: Math.max(0, Math.round((payment.amount - totals.total) * 100) / 100),
        status: "completed",
        timestamp: now.toISOString(),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

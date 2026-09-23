import { test, describe } from "node:test";
import assert from "node:assert";

interface IdempotentRecord {
  status: "LOCKED" | "COMPLETED";
  response?: any;
}

class IdempotencyStoreSimulator {
  private store: Map<string, IdempotentRecord> = new Map();
  private salesCount: number = 0;

  async processRequest(key: string, payload: any): Promise<{ cached: boolean; data: any }> {
    const existing = this.store.get(key);
    if (existing) {
      if (existing.status === "COMPLETED") {
        return { cached: true, data: existing.response };
      }
      throw new Error("409 Conflict: Request is already processing.");
    }

    // Acquire lock
    this.store.set(key, { status: "LOCKED" });

    // Simulate sale processing
    this.salesCount += 1;
    const saleData = {
      saleId: `sale-00${this.salesCount}`,
      receiptNumber: `REC-100${this.salesCount}`,
      total: payload.amount,
      createdAt: new Date().toISOString(),
    };

    // Complete and cache
    this.store.set(key, { status: "COMPLETED", response: saleData });
    return { cached: false, data: saleData };
  }

  getTotalSalesCreated(): number {
    return this.salesCount;
  }
}

describe("POS Idempotency & Duplicate Replay Tests", () => {
  test("Submitting the exact same idempotency key twice returns cached sale without duplicating transaction", async () => {
    const store = new IdempotencyStoreSimulator();
    const idempotencyKey = "pos-term-01-uuid-999";
    const payload = { amount: 3850 };

    // Request 1: initial submission
    const res1 = await store.processRequest(idempotencyKey, payload);
    assert.strictEqual(res1.cached, false);
    assert.strictEqual(res1.data.receiptNumber, "REC-1001");

    // Request 2: duplicate submission (e.g. user double-clicked checkout or network retry)
    const res2 = await store.processRequest(idempotencyKey, payload);
    assert.strictEqual(res2.cached, true);
    assert.strictEqual(res2.data.saleId, res1.data.saleId, "Must return the exact same sale ID");
    assert.strictEqual(res2.data.receiptNumber, "REC-1001", "Must return the exact same receipt number");

    // Total database sales created must be 1, NOT 2
    assert.strictEqual(store.getTotalSalesCreated(), 1, "Only 1 sale record should have been created in database");
  });
});

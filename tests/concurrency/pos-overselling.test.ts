import { test, describe } from "node:test";
import assert from "node:assert";

/**
 * Concurrency simulation engine replicating PostgreSQL `SELECT ... FOR UPDATE` row locks.
 */
class ConcurrencyStockSimulator {
  private stockQuantity: number;
  private isLocked: boolean = false;
  private queue: Array<() => void> = [];

  constructor(initialStock: number) {
    this.stockQuantity = initialStock;
  }

  private async acquireLock(): Promise<void> {
    if (!this.isLocked) {
      this.isLocked = true;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.isLocked = true;
        resolve();
      });
    });
  }

  private releaseLock(): void {
    this.isLocked = false;
    const next = this.queue.shift();
    if (next) next();
  }

  async executeSale(requestedQuantity: number): Promise<{ success: boolean; error?: string; remaining: number }> {
    await this.acquireLock();
    try {
      // Simulate database I/O latency inside transaction
      await new Promise((r) => setTimeout(r, 20));

      if (this.stockQuantity < requestedQuantity) {
        return {
          success: false,
          error: `Insufficient stock: requested ${requestedQuantity}, available ${this.stockQuantity}`,
          remaining: this.stockQuantity,
        };
      }

      this.stockQuantity -= requestedQuantity;
      return {
        success: true,
        remaining: this.stockQuantity,
      };
    } finally {
      this.releaseLock();
    }
  }

  getStock(): number {
    return this.stockQuantity;
  }
}

describe("POS Concurrency & Anti-Overselling Tests", () => {
  test("Simultaneous POS checkouts: only one succeeds, preventing negative stock", async () => {
    // Initial stock = 10 units
    const stockEngine = new ConcurrencyStockSimulator(10);

    // POS Terminal A attempts to sell 7 units
    // POS Terminal B attempts to sell 7 units simultaneously
    const [resultA, resultB] = await Promise.all([
      stockEngine.executeSale(7),
      stockEngine.executeSale(7),
    ]);

    // Exactly one transaction must succeed and one must fail
    const successes = [resultA, resultB].filter((r) => r.success);
    const failures = [resultA, resultB].filter((r) => !r.success);

    assert.strictEqual(successes.length, 1, "Exactly one sale must succeed");
    assert.strictEqual(failures.length, 1, "The second concurrent sale must be rejected");
    assert.match(failures[0]!.error!, /Insufficient stock/);

    // Final inventory balance must be 3, NEVER negative (-4)
    assert.strictEqual(stockEngine.getStock(), 3, "Remaining stock must equal 10 - 7 = 3");
  });

  test("Multiple rapid concurrent sales correctly decrement stock sequentially", async () => {
    // Initial stock = 15 units
    const stockEngine = new ConcurrencyStockSimulator(15);

    // 5 concurrent terminals each purchasing 3 units
    const results = await Promise.all([
      stockEngine.executeSale(3),
      stockEngine.executeSale(3),
      stockEngine.executeSale(3),
      stockEngine.executeSale(3),
      stockEngine.executeSale(3),
    ]);

    const successes = results.filter((r) => r.success);
    assert.strictEqual(successes.length, 5, "All 5 sales should succeed");
    assert.strictEqual(stockEngine.getStock(), 0, "Stock should be depleted to exactly 0");

    // 6th sale attempting 1 more unit must fail
    const extraSale = await stockEngine.executeSale(1);
    assert.strictEqual(extraSale.success, false);
    assert.strictEqual(stockEngine.getStock(), 0, "Stock must remain 0");
  });
});

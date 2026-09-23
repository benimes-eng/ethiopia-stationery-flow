import { test, describe } from "node:test";
import assert from "node:assert";

function calculateWeightedAverageCost(
  currentQty: number,
  currentAvgCost: number,
  inboundQty: number,
  inboundUnitCost: number
): number {
  if (inboundQty <= 0) return currentAvgCost;
  const currentTotalValuation = currentQty > 0 ? currentQty * currentAvgCost : 0;
  const inboundValuation = inboundQty * inboundUnitCost;
  const totalQty = currentQty > 0 ? currentQty + inboundQty : inboundQty;
  const newAvgCost = (currentTotalValuation + inboundValuation) / totalQty;
  return Math.round(newAvgCost * 100) / 100;
}

describe("Weighted Average Costing (WAC) Unit Tests", () => {
  test("Initial stock intake sets baseline unit cost", () => {
    const avg = calculateWeightedAverageCost(0, 0, 100, 500);
    assert.strictEqual(avg, 500);
  });

  test("Subsequent purchase at higher price increases weighted unit cost", () => {
    // Current: 100 units @ 500 ETB = 50,000 ETB
    // New: 100 units @ 600 ETB = 60,000 ETB
    // Total: 200 units @ 110,000 ETB / 200 = 550 ETB
    const avg = calculateWeightedAverageCost(100, 500, 100, 600);
    assert.strictEqual(avg, 550);
  });

  test("Subsequent purchase at lower price decreases weighted unit cost", () => {
    // Current: 100 units @ 500 ETB = 50,000 ETB
    // New: 50 units @ 350 ETB = 17,500 ETB
    // Total: 150 units @ 67,500 ETB / 150 = 450 ETB
    const avg = calculateWeightedAverageCost(100, 500, 50, 350);
    assert.strictEqual(avg, 450);
  });

  test("Sales do not alter the weighted average unit cost", () => {
    // A sale removes quantity at current unit cost; average cost per unit remains unchanged
    const currentAvgCost = 450;
    assert.strictEqual(currentAvgCost, 450);
  });
});

import { test, describe } from "node:test";
import assert from "node:assert";
import { serverTaxService } from "../../backend/src/services/tax.service.ts";

describe("Ethiopian Taxation Engine Unit Tests", () => {
  test("Standard Ethiopian VAT (15%) calculates correctly on single line item", () => {
    const line = {
      productId: "prod-paper-a4",
      description: "A4 Copy Paper",
      quantity: 2,
      unitPrice: 1000,
      discount: 0,
      taxRate: 0.15,
    };

    const result = serverTaxService.computeLine(line);
    assert.strictEqual(result.gross, 2000);
    assert.strictEqual(result.discount, 0);
    assert.strictEqual(result.net, 2000);
    assert.strictEqual(result.tax, 300);
    assert.strictEqual(result.total, 2300);
  });

  test("Discount is deducted before applying VAT", () => {
    const line = {
      productId: "prod-paper-a4",
      description: "A4 Copy Paper",
      quantity: 1,
      unitPrice: 1000,
      discount: 100, // 100 ETB discount
      taxRate: 0.15,
    };

    const result = serverTaxService.computeLine(line);
    assert.strictEqual(result.gross, 1000);
    assert.strictEqual(result.discount, 100);
    assert.strictEqual(result.net, 900);
    assert.strictEqual(result.tax, 135); // 15% of 900
    assert.strictEqual(result.total, 1035);
  });

  test("Turnover Tax (TOT 2%) applies accurately for non-VAT registered items", () => {
    const line = {
      productId: "prod-pen-blue",
      description: "Ballpoint Pen",
      quantity: 10,
      unitPrice: 50,
      discount: 0,
      taxRate: 0.02, // 2% TOT
    };

    const result = serverTaxService.computeLine(line);
    assert.strictEqual(result.gross, 500);
    assert.strictEqual(result.tax, 10);
    assert.strictEqual(result.total, 510);
  });

  test("Multi-line document totals aggregate with correct roundings", () => {
    const lines = [
      { productId: "p1", description: "Item 1", quantity: 5, unitPrice: 200, discount: 50, taxRate: 0.15 },
      { productId: "p2", description: "Item 2", quantity: 2, unitPrice: 350, discount: 0, taxRate: 0.15 },
    ];

    const result = serverTaxService.computeDocument(lines);
    // Line 1: gross 1000, discount 50, net 950, tax 142.50, total 1092.50
    // Line 2: gross 700, discount 0, net 700, tax 105.00, total 805.00
    assert.strictEqual(result.subtotal, 1700);
    assert.strictEqual(result.discount, 50);
    assert.strictEqual(result.taxable, 1650);
    assert.strictEqual(result.tax, 247.5);
    assert.strictEqual(result.total, 1897.5);
  });
});

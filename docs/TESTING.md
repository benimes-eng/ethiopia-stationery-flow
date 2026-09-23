# Test Suite, Concurrency Verification & Quality Assurance

## 1. Test Architecture Overview

The system includes automated tests covering business logic correctness, Ethiopian taxation, weighted average inventory valuation, and multi-terminal concurrency safety.

---

## 2. Running Tests

Execute the full suite using Node.js native test runner:

```bash
# Run all unit and concurrency tests
node --test tests/unit/*.test.ts tests/concurrency/*.test.ts
```

### Verified Test Suites:
1. `tests/unit/tax-engine.test.ts`:
   - Ethiopian 15% VAT calculation.
   - 2% TOT calculation.
   - Pre-tax discount deductions.
   - Multi-line document tax rounding.
2. `tests/unit/wac.test.ts`:
   - Initial stock procurement valuation.
   - Re-calculation of average cost when purchasing at higher/lower prices.
   - Verification that sales and transfers do not alter unit cost.
3. `tests/concurrency/pos-overselling.test.ts`:
   - Simulates two POS terminals submitting simultaneous checkouts for 7 items when only 10 exist.
   - Verifies exactly one transaction succeeds while the other is rejected with `InsufficientStockError`.
   - Verifies remaining stock equals 3 (never allowing negative inventory).
4. `tests/concurrency/idempotency.test.ts`:
   - Verifies that duplicate checkout requests with identical idempotency keys return the cached receipt without creating duplicate sales or double-debiting inventory.

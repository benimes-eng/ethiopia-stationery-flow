# Point of Sale (POS) Counter Terminal Architecture

## 1. Overview

The POS terminal is built for speed, offline resilience, and zero transaction loss in busy retail stationery counters across Addis Ababa and regional commercial centers.

---

## 2. Peripheral Interfaces

### 2.1 Barcode Scanner (Keyboard Wedge)
Most barcode scanners in Ethiopia connect via USB HID keyboard emulation.
- Handled by `KeyboardBarcodeScanner` in `hardware.service.ts`.
- Keystroke buffer detects rapid consecutive inputs (<120ms gap) culminating in `Enter`.
- Automatically emits a product lookup event directly into the cart without requiring mouse focus in an input box.

### 2.2 Thermal Receipt Printing (80mm)
- Standard 80mm thermal format with Ethiopian enterprise legal header, TIN, VAT registration, receipt number, cashier name, itemized lines, and 15% VAT breakdown.
- Rendered via a dedicated hidden print iframe to avoid blocking counter operations.

---

## 3. Idempotency & Network Retries

Every checkout request generates a client-side UUID:
`Idempotency-Key: pos-term-01-uuid-<timestamp>`

- If a network blip occurs after the server commits the sale, the POS terminal can safely retry with the exact same key.
- The server recognizes the key, suppresses duplicate sale and inventory deductions, and returns the original receipt record.

---

## 4. Separation of Concerns on Failure

A failure in peripheral hardware (e.g. printer out of paper, fiscal device timed out) **does not abort or lose the financial transaction in the database**. The sale is committed, and the cashier is provided a one-click "Reprint Receipt" option once paper is reloaded.

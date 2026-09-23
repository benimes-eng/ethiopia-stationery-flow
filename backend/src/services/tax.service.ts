export interface DocumentLineInput {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // amount
  taxRate?: number; // e.g. 0.15
}

export interface TaxCalculationResult {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
}

export const serverTaxService = {
  computeLine(line: DocumentLineInput) {
    const gross = line.quantity * line.unitPrice;
    const discount = Math.min(line.discount ?? 0, gross);
    const net = gross - discount;
    const taxRate = line.taxRate ?? 0.15; // default Ethiopian 15% VAT
    const tax = Math.round(net * taxRate * 100) / 100;
    return {
      gross,
      discount,
      net,
      taxRate,
      tax,
      total: net + tax,
    };
  },

  computeDocument(lines: DocumentLineInput[]): TaxCalculationResult {
    let subtotal = 0;
    let discount = 0;
    let tax = 0;

    for (const line of lines) {
      const computed = this.computeLine(line);
      subtotal += computed.gross;
      discount += computed.discount;
      tax += computed.tax;
    }

    const taxable = subtotal - discount;
    const total = Math.round((taxable + tax) * 100) / 100;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: Math.round(discount * 100) / 100,
      taxable: Math.round(taxable * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      total,
    };
  },
};

import type { Invoice } from "@/domain/types";

/**
 * FiscalAdapter boundary for Ethiopian e-invoicing / Ministry of Revenue.
 *
 * NOT IMPLEMENTED. The application must never claim fiscal compliance.
 * A future `EthiopiaFiscalAdapter` implements this interface (device
 * registration, invoice signing, QR payload, MoR submission).
 */

export interface FiscalSubmission {
  invoiceNumber: string;
  fiscalNumber?: string;
  qrPayload?: string;
  submittedAt?: string;
}

export interface FiscalAdapter {
  readonly id: "none" | "ethiopia";
  readonly label: string;
  isConfigured(): boolean;
  status(): { state: "not_configured" | "ready" | "error"; detail: string };
  submitInvoice(invoice: Invoice): Promise<FiscalSubmission>;
}

class NoopFiscalAdapter implements FiscalAdapter {
  readonly id = "none" as const;
  readonly label = "No fiscal integration";
  isConfigured() {
    return false;
  }
  status() {
    return {
      state: "not_configured" as const,
      detail:
        "No fiscal device or e-invoicing endpoint is configured. Invoices are issued as internal documents only.",
    };
  }
  async submitInvoice(): Promise<FiscalSubmission> {
    throw new Error("Fiscal submission is not available: no fiscal adapter is configured.");
  }
}

// TODO(cursor): implement EthiopiaFiscalAdapter (MoR API, signing, QR, retries).
export const fiscalAdapter: FiscalAdapter = new NoopFiscalAdapter();

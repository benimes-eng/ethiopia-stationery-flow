/**
 * Feature registry / flags.
 *
 * Modules that require heavy infrastructure stay OFF and are surfaced in the UI
 * as "Coming in a future release" — never as working functionality.
 */

export type FeatureKey =
  | "printingServices"
  | "customerCredit"
  | "offlinePOS"
  | "bankIntegration"
  | "mobilePayments"
  | "advancedAccounting"
  | "delivery"
  | "ecommerce"
  | "aiForecasting"
  | "fiscalIntegration";

export interface FeatureDefinition {
  key: FeatureKey;
  name: string;
  description: string;
  enabled: boolean;
  status: "planned" | "in_design" | "available";
}

export const FEATURES: Record<FeatureKey, FeatureDefinition> = {
  printingServices: {
    key: "printingServices",
    name: "Print & Copy Services",
    description: "Copy, print, binding and lamination job management with service materials.",
    enabled: false,
    status: "planned",
  },
  customerCredit: {
    key: "customerCredit",
    name: "Customer Credit",
    description: "Credit sales, receivables and aging. Not supported in this release.",
    enabled: false,
    status: "planned",
  },
  offlinePOS: {
    key: "offlinePOS",
    name: "Offline POS",
    description: "IndexedDB queue, idempotent sync and conflict resolution.",
    enabled: false,
    status: "in_design",
  },
  bankIntegration: {
    key: "bankIntegration",
    name: "Bank Integrations",
    description: "Automated bank verification. Payments are recorded manually today.",
    enabled: false,
    status: "planned",
  },
  mobilePayments: {
    key: "mobilePayments",
    name: "Mobile Payments",
    description: "Telebirr and mobile-money collection.",
    enabled: false,
    status: "planned",
  },
  advancedAccounting: {
    key: "advancedAccounting",
    name: "Advanced Accounting",
    description: "General ledger, journals and financial statements.",
    enabled: false,
    status: "planned",
  },
  delivery: {
    key: "delivery",
    name: "Delivery Management",
    description: "Dispatch, routing and proof of delivery.",
    enabled: false,
    status: "planned",
  },
  ecommerce: {
    key: "ecommerce",
    name: "E-commerce",
    description: "Online storefront and order intake.",
    enabled: false,
    status: "planned",
  },
  aiForecasting: {
    key: "aiForecasting",
    name: "AI Forecasting",
    description: "Demand forecasting and automated reorder suggestions.",
    enabled: false,
    status: "planned",
  },
  fiscalIntegration: {
    key: "fiscalIntegration",
    name: "Ethiopian Fiscal Integration",
    description: "Ministry of Revenue e-invoicing and QR verification via FiscalAdapter.",
    enabled: false,
    status: "planned",
  },
};

export const FEATURE_LIST = Object.values(FEATURES);

export function isFeatureEnabled(key: FeatureKey): boolean {
  return FEATURES[key].enabled;
}

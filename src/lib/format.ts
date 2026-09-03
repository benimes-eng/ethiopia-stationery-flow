/**
 * Centralised formatting utilities. Never format currency/dates inline in
 * components — multi-currency support plugs in here later.
 */

export const DEFAULT_CURRENCY = "ETB" as const;

const numberFormatter = new Intl.NumberFormat("en-ET", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const intFormatter = new Intl.NumberFormat("en-ET", { maximumFractionDigits: 0 });

export function formatCurrency(value: number, options?: { compact?: boolean; symbol?: boolean }) {
  const symbol = options?.symbol === false ? "" : `${DEFAULT_CURRENCY} `;
  if (options?.compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 10_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
  }
  return `${symbol}${numberFormatter.format(value)}`;
}

export function formatNumber(value: number) {
  return intFormatter.format(value);
}

export function formatQuantity(value: number) {
  return Number.isInteger(value) ? intFormatter.format(value) : numberFormatter.format(value);
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${formatDate(d)} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function formatTime(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function toISODate(value: Date = new Date()) {
  return value.toISOString().slice(0, 10);
}

export function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

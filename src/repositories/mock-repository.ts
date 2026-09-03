import { buildDatabase, SEED_TENANT_ID, type Database } from "@/mocks/seed";
import type { AuditLog, ID } from "@/domain/types";

/**
 * In-memory mock repository.
 *
 * The service layer talks to this module only. Replacing it with an
 * `ApiRepository` (HTTP/Supabase) requires no UI changes — the shape of the
 * exported helpers is the contract.
 */

let database: Database | null = null;

export function db(): Database {
  if (!database) database = buildDatabase();
  return database;
}

export function resetDatabase() {
  database = buildDatabase();
}

export const ACTIVE_TENANT_ID: ID = SEED_TENANT_ID;

/** Simulated network latency so loading states are exercised realistically. */
export function delay<T>(value: T, ms = 140): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function scoped<T extends { tenantId: ID }>(rows: T[], tenantId = ACTIVE_TENANT_ID): T[] {
  return rows.filter((r) => r.tenantId === tenantId);
}

export function uid(prefix: string): ID {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nextNumber(sequence: keyof Database["sequences"], prefix: string): string {
  const data = db();
  data.sequences[sequence] = (data.sequences[sequence] ?? 1000) + 1;
  return `${prefix}-${data.sequences[sequence]}`;
}

export function recordAudit(entry: Omit<AuditLog, "id" | "tenantId" | "createdAt">) {
  db().audit.unshift({
    ...entry,
    id: uid("aud"),
    tenantId: ACTIVE_TENANT_ID,
    createdAt: new Date().toISOString(),
  });
}

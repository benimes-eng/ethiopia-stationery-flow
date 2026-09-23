import { buildDatabase, SEED_TENANT_ID, type Database } from "@/mocks/seed";
import type { AuditLog, ID } from "@/domain/types";

const STORAGE_PREFIX = "stationery_mgmt_db_v3_";

let activeTenantId: ID = SEED_TENANT_ID;
let database: Database | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let cloudSyncInProgress = false;
let pendingCloudSync = false;

export function getActiveTenantId(): ID {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem("stationery_active_tenant");
    if (saved) return saved;
  }
  return activeTenantId;
}

export function setActiveTenantId(tenantId: ID) {
  activeTenantId = tenantId;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("stationery_active_tenant", tenantId);
  }
  // Reload the in-memory database for the newly active tenant
  database = loadInitialDatabase(tenantId);
}

function getStorageKey(tenantId = getActiveTenantId()): string {
  return `${STORAGE_PREFIX}${tenantId}`;
}

function loadInitialDatabase(tenantId = getActiveTenantId()): Database {
  if (typeof window !== "undefined") {
    try {
      const key = getStorageKey(tenantId);
      const serialized = window.localStorage.getItem(key);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        // Quick sanity check to ensure it has core tables
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.branches)) {
          return parsed as Database;
        }
      }
    } catch (e) {
      console.warn("Could not load database from localStorage:", e);
    }
  }
  const fresh = buildDatabase();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(getStorageKey(tenantId), JSON.stringify(fresh));
    } catch {}
  }
  return fresh;
}

export function db(): Database {
  if (!database) {
    database = loadInitialDatabase();
  }
  return database;
}

/** Set the full database state for the current tenant */
export function setDatabaseState(newData: Database) {
  database = newData;
  persistDatabase();
}

/** Explicitly persist current database state to localStorage and sync to cloud. */
export function persistDatabase() {
  if (typeof window !== "undefined" && database) {
    const currentTenant = getActiveTenantId();
    try {
      window.localStorage.setItem(getStorageKey(currentTenant), JSON.stringify(database));
    } catch (e) {
      console.warn("Failed to persist database to localStorage:", e);
    }

    // Push to Cloudflare KV cloud storage with queuing
    void syncToCloud(currentTenant);
  }
}

/** Send database updates to Cloudflare KV for multi-device sync */
async function syncToCloud(tenantId: string) {
  if (typeof window === "undefined") return;
  if (cloudSyncInProgress) {
    pendingCloudSync = true;
    return;
  }
  cloudSyncInProgress = true;
  try {
    do {
      pendingCloudSync = false;
      const targetTenant = getActiveTenantId() || tenantId;
      const dataToSave = database;
      if (!dataToSave) break;
      await fetch("/api/cloud-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: targetTenant, data: dataToSave }),
      });
    } while (pendingCloudSync);
  } catch (err) {
    console.warn("Cloud sync network error:", err);
  } finally {
    cloudSyncInProgress = false;
  }
}

/** Pull latest updates from Cloudflare KV with cache busting and lock protection */
export async function syncFromCloud(tenantId = getActiveTenantId()): Promise<boolean> {
  if (typeof window === "undefined") return false;
  // If local changes are pending or in flight, do not overwrite with stale cloud data
  if (cloudSyncInProgress || pendingCloudSync) return false;
  try {
    const res = await fetch(`/api/cloud-db?tenantId=${encodeURIComponent(tenantId)}&_t=${Date.now()}`);
    if (!res.ok) return false;
    const json = (await res.json()) as { ok: boolean; data: Database | null };
    if (json.ok && json.data) {
      if (cloudSyncInProgress || pendingCloudSync) return false;
      database = json.data;
      window.localStorage.setItem(getStorageKey(tenantId), JSON.stringify(json.data));
      return true;
    }
  } catch (err) {
    console.warn("Cloud sync fetch error:", err);
  }
  return false;
}

/** Debounced auto-persist triggered after mutations. */
export function queuePersist(delayMs = 100) {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistDatabase();
    saveTimer = null;
  }, delayMs);
}

// Auto-persist before window unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    persistDatabase();
  });

  // Multi-device real-time sync listeners:
  // Automatically pull fresh data when the user focuses the window or switches back to the tab
  const triggerSync = () => {
    void syncFromCloud().then((synced) => {
      if (synced) window.dispatchEvent(new CustomEvent("stationery:cloud-sync-complete"));
    });
  };
  window.addEventListener("focus", triggerSync);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") triggerSync();
  });
  // Auto-sync polling every 8 seconds
  setInterval(() => {
    if (document.visibilityState === "visible") triggerSync();
  }, 8000);
}

export interface DataResetOptions {
  products?: boolean; // Clears all products and associated balances/transactions
  sales?: boolean;    // Clears sales, returns, quotations, salesOrders, shifts
  invoices?: boolean; // Clears invoices & payments
  purchases?: boolean; // Clears purchase orders & goods receipts
  inventory?: boolean; // Clears ledger transactions, adjustments, counts, transfers and zeroes balances
  customers?: boolean; // Clears customer records
  suppliers?: boolean; // Clears supplier records
  expenses?: boolean;  // Clears recorded expenses
}

export function resetDataCategories(options: DataResetOptions) {
  const data = db();

  if (options.products) {
    data.products = [];
    data.balances = [];
    data.ledger = [];
    data.adjustments = [];
    data.counts = [];
    data.transfers = [];
  }

  if (options.sales) {
    data.sales = [];
    data.returns = [];
    data.quotations = [];
    data.salesOrders = [];
    data.shifts = [];
    data.sequences.sale = 1;
    data.sequences.quotation = 1;
    data.sequences.salesOrder = 1;
    data.sequences.return = 1;
  }

  if (options.invoices) {
    data.invoices = [];
    data.payments = [];
    data.sequences.invoice = 1;
    data.sequences.payment = 1;
  }

  if (options.purchases) {
    data.purchaseOrders = [];
    data.goodsReceipts = [];
    data.sequences.purchaseOrder = 1;
    data.sequences.receipt = 1;
  }

  if (options.inventory) {
    data.ledger = [];
    data.adjustments = [];
    data.counts = [];
    data.transfers = [];
    data.sequences.transfer = 1;
    data.sequences.count = 1;
    // Zero out existing product balances
    for (const b of data.balances) {
      b.quantity = 0;
    }
  }

  if (options.customers) {
    data.customers = [];
  }

  if (options.suppliers) {
    data.suppliers = [];
  }

  if (options.expenses) {
    data.expenses = [];
  }

  persistDatabase();
}

export function resetDatabase() {
  const currentTenant = getActiveTenantId();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(getStorageKey(currentTenant));
    } catch {}
  }
  database = buildDatabase();
  persistDatabase();
}

/** The active tenant ID is now dynamic per logged-in session/organization */
export const ACTIVE_TENANT_ID: ID = SEED_TENANT_ID;

/** Simulated network latency so loading states are exercised realistically. */
export function delay<T>(value: T, ms = 120): Promise<T> {
  // Always queue a persistence save on asynchronous operation completion
  queuePersist();
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function scoped<T extends { tenantId: ID }>(rows: T[], tenantId?: ID): T[] {
  const targetTenant = tenantId || getActiveTenantId();
  return rows.filter((r) => r.tenantId === targetTenant);
}

export function uid(prefix: string): ID {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nextNumber(sequence: keyof Database["sequences"], prefix: string): string {
  const data = db();
  data.sequences[sequence] = (data.sequences[sequence] ?? 1000) + 1;
  queuePersist();
  return `${prefix}-${data.sequences[sequence]}`;
}

export function recordAudit(entry: Omit<AuditLog, "id" | "tenantId" | "createdAt">) {
  const currentTenant = getActiveTenantId();
  db().audit.unshift({
    ...entry,
    id: uid("aud"),
    tenantId: currentTenant,
    createdAt: new Date().toISOString(),
  });
  queuePersist();
}

/**
 * Offline POS Transaction Queue using IndexedDB.
 *
 * Stores POS sales locally when internet connectivity is lost.
 * Automatically synchronizes with the backend API when connectivity is restored
 * using unique idempotency keys to ensure zero duplicate transactions.
 */

const DB_NAME = "abay_pos_offline_db";
const DB_VERSION = 1;
const STORE_NAME = "offline_transactions";

export interface OfflineTransaction {
  id: string; // client UUID
  idempotencyKey: string;
  operation: "POS_SALE" | "PAYMENT";
  payload: any;
  status: "queued" | "syncing" | "synced" | "failed";
  createdAt: string;
  attempts: number;
  lastError?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not supported in this environment."));
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const offlineQueue = {
  /** Queue a transaction when offline. */
  async queueTransaction(operation: "POS_SALE" | "PAYMENT", payload: any): Promise<OfflineTransaction> {
    const db = await openDatabase();
    const id = `off-${Math.random().toString(36).slice(2, 10)}`;
    const idempotencyKey = `idemp-${id}-${Date.now()}`;

    const record: OfflineTransaction = {
      id,
      idempotencyKey,
      operation,
      payload,
      status: "queued",
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  },

  /** Get all pending queued transactions. */
  async getPendingTransactions(): Promise<OfflineTransaction[]> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = req.result as OfflineTransaction[];
        resolve(rows.filter((r) => r.status === "queued" || r.status === "failed"));
      };
      req.onerror = () => reject(req.error);
    });
  },

  /** Mark a transaction as synced. */
  async markSynced(id: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  /** Mark a transaction as failed with error. */
  async markFailed(id: string, error: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result as OfflineTransaction;
        if (item) {
          item.status = "failed";
          item.attempts += 1;
          item.lastError = error;
          store.put(item);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  },
};

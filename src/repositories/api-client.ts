import { offlineQueue } from "./offline-queue";

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000/api/v1";

export class ApiError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const apiClient = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("abay_access_token");
  },

  setToken(token: string | null) {
    if (typeof window === "undefined") return;
    if (token) {
      window.localStorage.setItem("abay_access_token", token);
    } else {
      window.localStorage.removeItem("abay_access_token");
    }
  },

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_BASE_URL}${path}`;

    try {
      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(
          body.error?.code || "HTTP_ERROR",
          body.error?.message || `Request failed with status ${response.status}`,
          response.status
        );
      }

      return (await response.json()) as T;
    } catch (error: any) {
      // If network offline and calling checkout, queue to IndexedDB
      if (path === "/pos/checkout" && (!navigator.onLine || error.name === "TypeError")) {
        console.warn("Network unavailable. Queuing POS transaction to local IndexedDB.");
        const payload = JSON.parse(options.body as string);
        const queued = await offlineQueue.queueTransaction("POS_SALE", payload);
        return {
          saleId: queued.id,
          receiptNumber: `OFF-${queued.id.slice(-6).toUpperCase()}`,
          totals: { total: payload.lines.reduce((s: number, l: any) => s + l.quantity * l.unitPrice, 0) },
          status: "queued_offline",
          timestamp: queued.createdAt,
        } as unknown as T;
      }
      throw error;
    }
  },

  get<T>(path: string) {
    return this.request<T>(path, { method: "GET" });
  },

  post<T>(path: string, body: any, headers?: Record<string, string>) {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    });
  },

  put<T>(path: string, body: any) {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
};

import { create } from "zustand";
import type { ID, Permission, User } from "@/domain/types";
import { ROLES } from "@/domain/permissions";
import { db } from "@/repositories/mock-repository";
import { PLATFORM_SUPERADMIN_USER, SUPERADMIN_TENANT_ID } from "@/mocks/seed";

const STORAGE_KEY = "abay.session.v1";

/** Fired on window after cloud data is pulled so React Query can invalidate all caches */
export const CLOUD_SYNC_EVENT = "stationery:cloud-sync-complete";

interface SessionState {
  user: User | null;
  branchId: ID | "all";
  hydrated: boolean;
  sessionExpired: boolean;
  hydrate: () => void;
  signIn: (user: User) => void;
  signOut: () => void;
  expireSession: () => void;
  setBranch: (branchId: ID | "all") => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  branchId: "all",
  hydrated: false,
  sessionExpired: false,

  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        set({ hydrated: true });
        return;
      }
      const parsed = JSON.parse(raw) as {
        userId: string;
        branchId: ID | "all";
        tenantId?: string;
        isSuperadmin?: boolean;
      };

      // Restore superadmin session without touching tenant DB
      if (parsed.isSuperadmin) {
        set({ user: PLATFORM_SUPERADMIN_USER, branchId: "all", hydrated: true });
        return;
      }

      if (parsed.tenantId) {
        import("@/repositories/mock-repository").then(({ setActiveTenantId, syncFromCloud }) => {
          setActiveTenantId(parsed.tenantId!);
          syncFromCloud(parsed.tenantId!).then((synced) => {
            if (synced && typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent(CLOUD_SYNC_EVENT));
            }
          });
        });
      }

      const user = db().users.find((u) => u.id === parsed.userId) ?? null;
      set({
        user,
        branchId: parsed.branchId,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  signIn: (user) => {
    if (typeof window !== "undefined") {
      const isSuperadmin = user.tenantId === SUPERADMIN_TENANT_ID;
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          userId: user.id,
          branchId: user.branchId ?? "all",
          tenantId: user.tenantId,
          isSuperadmin,
        }),
      );

      if (!isSuperadmin) {
        import("@/repositories/mock-repository").then(({ setActiveTenantId, syncFromCloud }) => {
          setActiveTenantId(user.tenantId);
          syncFromCloud(user.tenantId).then((synced) => {
            if (synced && typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent(CLOUD_SYNC_EVENT));
            }
          });
        });
      }
    }
    set({ user, branchId: user.branchId ?? "all", sessionExpired: false });
  },

  signOut: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    set({ user: null, branchId: "all", sessionExpired: false });
  },

  expireSession: () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
    set({ user: null, sessionExpired: true });
  },

  setBranch: (branchId) =>
    set((state) => {
      if (typeof window !== "undefined" && state.user) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, branchId }));
      }
      return { branchId };
    }),
}));

/** Frontend-only permission gate. Server-side enforcement is still required. */
export function permissionsOf(user: User | null): Permission[] {
  return user ? ROLES[user.role].permissions : [];
}

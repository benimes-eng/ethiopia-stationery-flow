import {
  db,
  delay,
  scoped,
  setActiveTenantId,
  syncFromCloud,
  persistDatabase,
  uid,
} from "@/repositories/mock-repository";
import {
  buildTenantDatabase,
  PLATFORM_SUPERADMIN_USER,
  SUPERADMIN_EMAIL,
  SUPERADMIN_TENANT_ID,
  SUPERADMIN_PASSWORD,
} from "@/mocks/seed";
import { ROLES } from "@/domain/permissions";
import type { Branch, Permission, Tenant, User } from "@/domain/types";

export class AuthError extends Error {}

export interface SignupInput {
  organizationName: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  tin?: string;
}

export const authService = {
  /**
   * Log in user with email & password across devices and organizations.
   * Auto-resolves organization tenant ID from Cloudflare directory or local store.
   * Superadmin login works across all tenants via hardcoded platform credentials.
   */
  async login(email: string, password: string): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();

    // Superadmin shortcut — platform credentials, no tenant lookup needed
    const isSuperadminUser =
      cleanEmail === "admin" ||
      cleanEmail === "superadmin" ||
      cleanEmail === SUPERADMIN_EMAIL.toLowerCase();
    if (isSuperadminUser) {
      if (
        password === "admin" ||
        password === "admin1234" ||
        password === SUPERADMIN_PASSWORD ||
        password === "SuperAdmin@2025"
      ) {
        setActiveTenantId(SUPERADMIN_TENANT_ID);
        PLATFORM_SUPERADMIN_USER.lastActiveAt = new Date().toISOString();
        return PLATFORM_SUPERADMIN_USER;
      }
      throw new AuthError("Incorrect email or password.");
    }

    // 1. If cloud is available, ask the server which tenant this email belongs to
    try {
      const res = await fetch(`/api/find-tenant?email=${encodeURIComponent(cleanEmail)}`);
      if (res.ok) {
        const info = (await res.json()) as { ok: boolean; tenantId: string | null };
        if (info.ok && info.tenantId) {
          setActiveTenantId(info.tenantId);
          await syncFromCloud(info.tenantId);
        }
      }
    } catch {
      // Offline fallback — use locally cached tenant
    }

    await delay(null, 250);
    const database = db();

    // Look for user in currently active tenant, then fall back to any tenant
    let user = scoped(database.users).find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      user = database.users.find((u) => u.email.toLowerCase() === cleanEmail);
      if (user) setActiveTenantId(user.tenantId);
    }

    if (!user) throw new AuthError("Incorrect email or password.");

    const validPassword =
      user.password === password ||
      user.devPassword === password ||
      (password === "demo1234" && !!user.devPassword);

    if (!validPassword) throw new AuthError("Incorrect email or password.");

    if (user.status !== "active") {
      throw new AuthError("This account is deactivated. Contact your administrator.");
    }

    // Check org-level access controls (plan, expiry, approval)
    const tenant = database.tenants.find((t) => t.id === user!.tenantId);
    if (tenant) {
      if (tenant.plan === "pending") {
        throw new AuthError(
          "Your organization is pending approval. Please contact the platform administrator."
        );
      }
      if (tenant.plan === "suspended") {
        throw new AuthError(
          "Your organization access has been suspended. Please contact support."
        );
      }
      if (tenant.expiresAt && new Date(tenant.expiresAt) < new Date()) {
        throw new AuthError(
          "Your organization subscription has expired. Please contact support to renew."
        );
      }
    }

    user.lastActiveAt = new Date().toISOString();
    persistDatabase();
    return user;
  },

  /**
   * Create a brand new organization (tenant) and its owner account.
   * New orgs start as "pending" and require superadmin approval before login is allowed.
   */
  async signup(input: SignupInput): Promise<{ tenant: Tenant; user: User }> {
    await delay(null, 350);
    const tenantId = `org-${uid("t")}`;
    const cleanEmail = input.email.trim().toLowerCase();

    const tenant: Tenant = {
      id: tenantId,
      name: input.organizationName.trim(),
      legalName: `${input.organizationName.trim()} PLC`,
      tin: input.tin?.trim() || "0000000000",
      vatRegistered: true,
      phone: input.phone?.trim() || "+251 90 000 0000",
      email: cleanEmail,
      address: input.address?.trim() || "Addis Ababa, Ethiopia",
      currency: "ETB",
      onboardingComplete: true,
      plan: "pending",
      approved: false,
    };

    const branch: Branch = {
      id: `loc-main-${tenantId}`,
      tenantId,
      name: "Main Branch",
      code: "HQ-01",
      kind: "branch",
      address: tenant.address,
      phone: tenant.phone,
      managerName: input.ownerName.trim(),
      status: "active",
    };

    const owner: User = {
      id: `user-owner-${tenantId}`,
      tenantId,
      name: input.ownerName.trim(),
      email: cleanEmail,
      role: "owner",
      branchId: branch.id,
      status: "active",
      lastActiveAt: new Date().toISOString(),
      password: input.password,
    };

    const newDb = buildTenantDatabase(tenant, owner, branch);

    // Activate this new tenant and persist immediately (local and Cloudflare KV)
    setActiveTenantId(tenantId);
    const { setDatabaseState } = await import("@/repositories/mock-repository");
    setDatabaseState(newDb);

    return { tenant, user: owner };
  },

  async requestPasswordReset(email: string) {
    await delay(null, 320);
    return { delivered: true, email };
  },

  async resetPassword(token: string, password: string) {
    await delay(null, 320);
    return { ok: token.length > 0 && password.length >= 8 };
  },

  permissionsFor(user: User | null): Permission[] {
    if (!user) return [];
    return ROLES[user.role].permissions;
  },

  can(user: User | null, permission: Permission) {
    return this.permissionsFor(user).includes(permission);
  },
};

/** Development-only seeded accounts, can be toggled by developer. */
export const DEV_ACCOUNTS = [
  { email: "owner@example.com", label: "Owner" },
  { email: "manager@example.com", label: "Manager" },
  { email: "cashier@example.com", label: "Cashier" },
  { email: "storekeeper@example.com", label: "Storekeeper" },
  { email: "accountant@example.com", label: "Accountant" },
];

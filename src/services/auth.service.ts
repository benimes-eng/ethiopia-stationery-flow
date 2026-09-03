import { db, delay, scoped } from "@/repositories/mock-repository";
import { ROLES } from "@/domain/permissions";
import type { Permission, User } from "@/domain/types";

/**
 * AuthService — mock authentication against seeded development users.
 * A real implementation swaps this module for a token-based client; the
 * session store and permission hooks stay unchanged.
 */

export class AuthError extends Error {}

export const authService = {
  async login(email: string, password: string): Promise<User> {
    await delay(null, 320);
    const user = scoped(db().users).find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.devPassword !== password) {
      throw new AuthError("Incorrect email or password.");
    }
    if (user.status !== "active") {
      throw new AuthError("This account is deactivated. Contact your administrator.");
    }
    user.lastActiveAt = new Date().toISOString();
    return user;
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

/** Development-only seeded accounts, surfaced on the login screen. */
export const DEV_ACCOUNTS = [
  { email: "owner@example.com", label: "Owner" },
  { email: "manager@example.com", label: "Manager" },
  { email: "cashier@example.com", label: "Cashier" },
  { email: "storekeeper@example.com", label: "Storekeeper" },
  { email: "accountant@example.com", label: "Accountant" },
];

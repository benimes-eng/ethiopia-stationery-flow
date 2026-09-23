import { pgTable, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { branches } from "./locations.js";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(), // e.g. "user-owner"
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(), // 'owner' | 'manager' | 'cashier' | 'storekeeper' | 'accountant'
    branchId: text("branch_id").references(() => branches.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"), // 'active' | 'inactive' | 'locked'
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantEmailIdx: uniqueIndex("idx_users_tenant_email").on(table.tenantId, table.email),
    tenantRoleIdx: index("idx_users_tenant_role").on(table.tenantId, table.role),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // session UUID
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_sessions_user").on(table.userId),
    expiresIdx: index("idx_sessions_expires").on(table.expiresAt),
  })
);

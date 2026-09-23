import { pgTable, text, integer, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { branches } from "./locations.js";
import { users } from "./users.js";

export const documentSequences = pgTable(
  "document_sequences",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    documentType: text("document_type").notNull(), // 'Invoice' | 'Receipt' | 'Quotation' | 'Order' | 'PurchaseOrder' | 'GoodsReceipt' | 'Return' | 'Payment' | 'Transfer' | 'Count'
    prefix: text("prefix").notNull(),
    currentNumber: integer("current_number").notNull().default(1000),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantDocTypeBranchIdx: uniqueIndex("idx_doc_seq_tenant_type").on(table.tenantId, table.documentType),
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "set null" }),
    description: text("description").notNull(),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantAuditIdx: index("idx_audit_tenant_date").on(table.tenantId, table.createdAt),
    tenantAuditEntityIdx: index("idx_audit_entity").on(table.tenantId, table.entity, table.entityId),
  })
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(), // client provided idempotency key
    requestPath: text("request_path").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantKeyIdx: uniqueIndex("idx_idempotency_tenant_key").on(table.tenantId, table.key),
  })
);

export const syncQueue = pgTable(
  "sync_queue",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    transactionUuid: text("transaction_uuid").notNull(),
    operation: text("operation").notNull(), // 'POS_SALE' | 'PAYMENT'
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("pending"), // 'pending' | 'syncing' | 'completed' | 'failed'
    attempts: integer("attempts").notNull().default(0),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
  },
  (table) => ({
    tenantTxUuidIdx: uniqueIndex("idx_sync_tenant_uuid").on(table.tenantId, table.transactionUuid),
    tenantSyncStatusIdx: index("idx_sync_status").on(table.tenantId, table.status),
  })
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    read: boolean("read").notNull().default(false),
    link: text("link"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantUserNotifIdx: index("idx_notifications_user").on(table.tenantId, table.userId, table.read),
  })
);

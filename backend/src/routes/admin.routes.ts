import { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema/users.js";
import { branches } from "../db/schema/locations.js";
import { tenants, tenantSettings } from "../db/schema/tenants.js";
import { auditLogs } from "../db/schema/system.js";
import { authenticate } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { seedDatabase } from "../db/seeds/index.js";

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // USERS
  fastify.get("/users", { preHandler: [requirePermission("users.manage")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        branchId: users.branchId,
        status: users.status,
        lastActiveAt: users.lastActiveAt,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId))
      .orderBy(users.name);

    return { users: rows };
  });

  fastify.post("/users", { preHandler: [requirePermission("users.manage")] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const body = request.body as any;

    const passwordHash = await argon2.hash(body.password || "password123");
    const id = `user-${Math.random().toString(36).slice(2, 10)}`;

    const newUser = {
      id,
      tenantId,
      name: body.name,
      email: body.email.trim().toLowerCase(),
      phone: body.phone,
      passwordHash,
      role: body.role,
      branchId: body.branchId || null,
      status: body.status || "active",
    };

    await db.insert(users).values(newUser);
    return reply.status(201).send({ user: newUser });
  });

  fastify.put("/users/:id", { preHandler: [requirePermission("users.manage")] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const patch: any = { updatedAt: new Date() };
    if (body.name) patch.name = body.name;
    if (body.phone) patch.phone = body.phone;
    if (body.role) patch.role = body.role;
    if (body.branchId !== undefined) patch.branchId = body.branchId;
    if (body.status) patch.status = body.status;
    if (body.password) patch.passwordHash = await argon2.hash(body.password);

    await db.update(users).set(patch).where(and(eq(users.id, id), eq(users.tenantId, tenantId)));
    return { success: true };
  });

  // BRANCHES
  fastify.get("/branches", { preHandler: [requirePermission("branches.manage")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const rows = await db.select().from(branches).where(eq(branches.tenantId, tenantId)).orderBy(branches.name);
    return { branches: rows };
  });

  fastify.post("/branches", { preHandler: [requirePermission("branches.manage")] }, async (request, reply) => {
    const tenantId = request.user!.tenantId;
    const body = request.body as any;

    const id = `loc-${Math.random().toString(36).slice(2, 10)}`;
    const newBranch = {
      id,
      tenantId,
      name: body.name,
      code: body.code.toUpperCase(),
      kind: body.kind || "branch",
      address: body.address,
      phone: body.phone,
      status: body.status || "active",
    };

    await db.insert(branches).values(newBranch);
    return reply.status(201).send({ branch: newBranch });
  });

  // TENANT PROFILE
  fastify.get("/tenant", async (request) => {
    const tenantId = request.user!.tenantId;
    const t = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const s = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
    return { tenant: t[0], settings: s[0] };
  });

  fastify.put("/tenant", { preHandler: [requirePermission("settings.manage")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const body = request.body as any;

    await db.update(tenants).set({ ...body, updatedAt: new Date() }).where(eq(tenants.id, tenantId));
    return { success: true };
  });

  // AUDIT LOGS
  fastify.get("/audit", { preHandler: [requirePermission("audit.view")] }, async (request) => {
    const tenantId = request.user!.tenantId;
    const rows = await db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenantId)).orderBy(desc(auditLogs.createdAt)).limit(200);
    return { audit: rows };
  });

  // SECURE DEMO RESET
  fastify.post("/reset-demo", { preHandler: [requirePermission("settings.manage")] }, async (request, reply) => {
    if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEMO_RESET !== "true") {
      return reply.status(403).send({
        error: { code: "FORBIDDEN", message: "Database reset is disabled in production environments." },
      });
    }

    await seedDatabase();
    return { success: true, message: "Demo database successfully re-seeded." };
  });
}

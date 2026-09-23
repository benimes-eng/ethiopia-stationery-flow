import { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, sessions } from "../db/schema/users.js";
import { signAccessToken, signRefreshToken, authenticate } from "../middleware/auth.js";
import { ROLES } from "../../../src/domain/permissions.js";
import type { RoleKey } from "../../../src/domain/types.js";

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post("/login", async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    if (!email || !password) {
      return reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Email and password are required." },
      });
    }

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);

    const user = userRows[0];
    if (!user) {
      return reply.status(401).send({
        error: { code: "INVALID_CREDENTIALS", message: "Incorrect email or password." },
      });
    }

    if (user.status !== "active") {
      return reply.status(403).send({
        error: { code: "ACCOUNT_DEACTIVATED", message: "This account has been deactivated. Contact your administrator." },
      });
    }

    // Verify Argon2id hash
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      // Increment failed attempts
      await db
        .update(users)
        .set({ failedLoginAttempts: user.failedLoginAttempts + 1 })
        .where(eq(users.id, user.id));

      return reply.status(401).send({
        error: { code: "INVALID_CREDENTIALS", message: "Incorrect email or password." },
      });
    }

    // Reset failed attempts & record login
    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lastLoginAt: new Date(),
        lastActiveAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const payload = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as RoleKey,
      branchId: user.branchId,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Record session
    await db.insert(sessions).values({
      id: `sess-${Math.random().toString(36).slice(2, 10)}`,
      tenantId: user.tenantId,
      userId: user.id,
      refreshTokenHash: await argon2.hash(refreshToken),
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        branchId: user.branchId,
        permissions: ROLES[user.role as RoleKey]?.permissions ?? [],
      },
      accessToken,
      refreshToken,
    };
  });

  // Get current user profile
  fastify.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const authUser = request.user!;
    const userRows = await db
      .select()
      .from(users)
      .where(and(eq(users.id, authUser.userId), eq(users.tenantId, authUser.tenantId)))
      .limit(1);

    const user = userRows[0];
    if (!user) {
      return reply.status(404).send({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        branchId: user.branchId,
        permissions: ROLES[user.role as RoleKey]?.permissions ?? [],
      },
    };
  });

  // Logout
  fastify.post("/logout", { preHandler: [authenticate] }, async (request, reply) => {
    const authUser = request.user!;
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.userId, authUser.userId), eq(sessions.tenantId, authUser.tenantId)));

    return { success: true };
  });
}

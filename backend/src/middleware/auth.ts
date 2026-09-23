import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import type { RoleKey, Permission } from "../../../src/domain/types.js";
import { ROLES, roleCan } from "../../../src/domain/permissions.js";

export interface AuthUserPayload {
  userId: string;
  tenantId: string;
  role: RoleKey;
  branchId?: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUserPayload;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "abay_super_secret_jwt_key_min_32_chars_long!";

export function signAccessToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

export function signRefreshToken(payload: AuthUserPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET || "abay_super_secret_refresh_key_min_32_chars!";
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.status(401).send({
      error: { code: "UNAUTHORIZED", message: "Authentication required. Missing Bearer token." },
    });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    request.user = decoded;
  } catch (error) {
    return reply.status(401).send({
      error: { code: "INVALID_TOKEN", message: "Token expired or signature invalid." },
    });
  }
}

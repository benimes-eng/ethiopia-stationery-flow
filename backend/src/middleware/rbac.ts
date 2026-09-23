import { FastifyRequest, FastifyReply } from "fastify";
import type { Permission } from "../../../src/domain/types.js";
import { roleCan } from "../../../src/domain/permissions.js";

/**
 * Server-side RBAC guard. Ensures the authenticated user's role grants the requested permission.
 */
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Authentication required." },
      });
    }

    const hasPermission = roleCan(user.role, permission);
    if (!hasPermission) {
      return reply.status(403).send({
        error: {
          code: "FORBIDDEN",
          message: `Forbidden: role '${user.role}' lacks permission '${permission}'.`,
        },
      });
    }
  };
}

/**
 * Verifies that the user has permission to act on the specified branch.
 * Owners and Managers can access all branches; Cashiers/Storekeepers are restricted to their assigned branch.
 */
export function requireBranchScope(getBranchId: (req: FastifyRequest) => string | undefined) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) return;

    if (user.role === "owner" || user.role === "manager") {
      return; // Global access
    }

    const targetBranchId = getBranchId(request);
    if (targetBranchId && user.branchId && targetBranchId !== user.branchId) {
      return reply.status(403).send({
        error: {
          code: "BRANCH_FORBIDDEN",
          message: `Access denied: you are not assigned to branch '${targetBranchId}'.`,
        },
      });
    }
  };
}

import { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/client.js";
import { idempotencyKeys } from "../db/schema/system.js";
import { eq, and } from "drizzle-orm";

export async function checkIdempotency(request: FastifyRequest, reply: FastifyReply) {
  const key = (request.headers["idempotency-key"] || request.headers["x-idempotency-key"]) as string | undefined;
  if (!key || !request.user) return; // Skip if no key provided

  const tenantId = request.user.tenantId;

  // Check if key already exists
  const existing = await db
    .select()
    .from(idempotencyKeys)
    .where(and(eq(idempotencyKeys.tenantId, tenantId), eq(idempotencyKeys.key, key)))
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0]!;
    if (record.responseStatus) {
      // Return cached response
      reply.header("X-Cache-Lookup", "HIT-IDEMPOTENT");
      return reply.status(record.responseStatus).send(record.responseBody);
    }
    // Still in progress
    return reply.status(409).send({
      error: { code: "CONCURRENT_REQUEST", message: "A request with this idempotency key is already processing." },
    });
  }

  // Create pending idempotency record
  await db.insert(idempotencyKeys).values({
    id: `idemp-${Math.random().toString(36).slice(2, 10)}`,
    tenantId,
    key,
    requestPath: request.url,
    lockedUntil: new Date(Date.now() + 60000), // 1 minute lock
  });
}

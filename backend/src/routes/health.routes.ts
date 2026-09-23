import { FastifyInstance } from "fastify";
import { pool } from "../db/client.js";

export async function healthRoutes(fastify: FastifyInstance) {
  // Liveness probe
  fastify.get("/health", async () => {
    return { status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() };
  });

  // Readiness probe
  fastify.get("/ready", async (request, reply) => {
    try {
      // Test DB connection
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();

      return {
        status: "ready",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return reply.status(503).send({
        status: "unhealthy",
        database: "disconnected",
        error: error.message,
      });
    }
  });
}

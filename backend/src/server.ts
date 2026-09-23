import fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import * as dotenv from "dotenv";

import { authRoutes } from "./routes/auth.routes.js";
import { productRoutes } from "./routes/products.routes.js";
import { inventoryRoutes } from "./routes/inventory.routes.js";
import { posRoutes } from "./routes/pos.routes.js";
import { documentRoutes } from "./routes/documents.routes.js";
import { purchasingRoutes } from "./routes/purchasing.routes.js";
import { financeRoutes } from "./routes/finance.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { reportRoutes } from "./routes/reports.routes.js";
import { healthRoutes } from "./routes/health.routes.js";

dotenv.config();

const isDev = process.env.NODE_ENV !== "production";

const server = fastify({
  logger: isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard", ignore: "pid,hostname" },
        },
      }
    : true,
  disableRequestLogging: false,
});

async function bootstrap() {
  // 1. Security Plugins
  await server.register(helmet, {
    contentSecurityPolicy: false, // Managed by reverse proxy or frontend
  });

  const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((o) => o.trim());

  await server.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // 2. Centralized Error Handler
  server.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    // Don't leak raw SQL or database internal errors
    const statusCode = error.statusCode || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;

    reply.status(statusCode).send({
      error: {
        code: error.code || (isClientError ? "CLIENT_ERROR" : "INTERNAL_SERVER_ERROR"),
        message: isClientError ? error.message : "An unexpected internal server error occurred.",
      },
    });
  });

  // 3. Register Route Modules under /api/v1
  server.register(healthRoutes, { prefix: "/" });
  server.register(authRoutes, { prefix: "/api/v1/auth" });
  server.register(productRoutes, { prefix: "/api/v1/products" });
  server.register(inventoryRoutes, { prefix: "/api/v1/inventory" });
  server.register(posRoutes, { prefix: "/api/v1/pos" });
  server.register(documentRoutes, { prefix: "/api/v1/documents" });
  server.register(purchasingRoutes, { prefix: "/api/v1/purchasing" });
  server.register(financeRoutes, { prefix: "/api/v1/finance" });
  server.register(adminRoutes, { prefix: "/api/v1/admin" });
  server.register(reportRoutes, { prefix: "/api/v1/reports" });

  // 4. Start Listening
  const port = Number(process.env.PORT || 4000);
  const host = "0.0.0.0";

  await server.listen({ port, host });
  server.log.info(`Abay Stationery Backend API listening on http://localhost:${port}`);
}

// Graceful shutdown
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
for (const signal of signals) {
  process.on(signal, async () => {
    server.log.info(`Received ${signal}, shutting down gracefully...`);
    await server.close();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  server.log.fatal(err);
  process.exit(1);
});

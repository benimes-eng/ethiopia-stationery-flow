import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.js";
import * as dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres_dev_password@localhost:5432/abay_stationery_db",
  min: Number(process.env.DB_POOL_MIN || 2),
  max: Number(process.env.DB_POOL_MAX || 20),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

/**
 * Execute a callback within an isolated tenant transaction with RLS context.
 */
export async function withTenantTransaction<T>(
  tenantId: string,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Securely set the PostgreSQL session variable for Row-Level Security
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    
    const txDb = drizzle(client, { schema });
    const result = await callback(txDb as unknown as typeof db);
    
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

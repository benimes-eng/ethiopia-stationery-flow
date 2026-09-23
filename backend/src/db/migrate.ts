import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

export async function runMigrations() {
  console.log("Running database migrations...");
  try {
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("Database migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

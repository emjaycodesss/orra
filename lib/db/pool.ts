import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/db/env";

let pool: Pool | null = null;

/**
 * Shared pool for server routes. Throws if no URL configured (caller should use isGameDatabaseEnabled() first).
 */
export function getPool(): Pool {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("getPool: set ORRA_DATABASE_URL or DATABASE_URL");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.ORRA_PG_POOL_MAX ?? 10),
      connectionTimeoutMillis: Number(process.env.ORRA_PG_CONNECTION_TIMEOUT_MS ?? 10_000),
    });
  }
  return pool;
}

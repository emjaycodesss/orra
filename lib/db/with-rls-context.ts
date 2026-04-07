import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/pool";

/**
 * RLS policies use custom GUCs under `orra.*` (see migrations/005_rls.sql).
 * `set_config(..., true)` scopes values to the current transaction (safe for pooled connections).
 */
export async function withRlsContext<T>(
  vars: Record<string, string>,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of Object.entries(vars)) {
      const name = key.startsWith("orra.") ? key : `orra.${key}`;
      await client.query(`SELECT set_config($1::text, $2::text, true)`, [name, value]);
    }
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Add more transaction-local GUCs mid-transaction (caller manages BEGIN/COMMIT). */
export async function setRlsVars(client: PoolClient, vars: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(vars)) {
    const name = key.startsWith("orra.") ? key : `orra.${key}`;
    await client.query(`SELECT set_config($1::text, $2::text, true)`, [name, value]);
  }
}

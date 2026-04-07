import { setRlsVars, withRlsContext } from "@/lib/db/with-rls-context";
import type { LeaderboardRow } from "@/lib/game/leaderboard-types";
import type { PoolClient } from "pg";

function rowToLeaderboard(r: Record<string, unknown>): LeaderboardRow {
  return {
    id: r.id as string,
    wallet_address: r.wallet_address as string,
    score: Number(r.score),
    run_completed: Boolean(r.run_completed),
    display_name: (r.display_name as string | null) ?? null,
    twitter_handle: (r.twitter_handle as string | null) ?? null,
    chain_id: Number(r.chain_id),
    created_at:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
    questions_answered: Number(r.questions_answered),
    correct_count: Number(r.correct_count),
    pyth_iq: Number(r.pyth_iq),
    mean_latency_ms:
      r.mean_latency_ms === null || r.mean_latency_ms === undefined
        ? null
        : Number(r.mean_latency_ms),
    median_latency_ms:
      r.median_latency_ms === null || r.median_latency_ms === undefined
        ? null
        : Number(r.median_latency_ms),
    bosses_reached: Number(r.bosses_reached),
    power_ups_used: Number(r.power_ups_used),
    session_id:
      r.session_id === null || r.session_id === undefined
        ? null
        : String(r.session_id),
  };
}

export async function loadLeaderboardFromDb(): Promise<LeaderboardRow[]> {
  return withRlsContext({ leaderboard_select_all: "1" }, async (client) => {
    const r = await client.query(
      `SELECT id, wallet_address, score, run_completed, display_name, twitter_handle,
            chain_id, created_at, questions_answered, correct_count, pyth_iq,
            mean_latency_ms, median_latency_ms, bosses_reached, power_ups_used,
            session_id
     FROM orra_game_leaderboard`,
    );
    return r.rows.map((row) => rowToLeaderboard(row as Record<string, unknown>));
  });
}

async function trimLeaderboardToMax(client: PoolClient, maxRows: number) {
  await client.query(
    `DELETE FROM orra_game_leaderboard
     WHERE id NOT IN (
       SELECT id FROM orra_game_leaderboard
       ORDER BY created_at DESC
       LIMIT $1
     )`,
    [maxRows],
  );
}

export async function appendLeaderboardToDb(row: LeaderboardRow): Promise<void> {
  await withRlsContext(
    {
      wallet_address: row.wallet_address.toLowerCase(),
      ...(row.session_id ? { session_id: row.session_id } : {}),
    },
    async (client) => {
      const ins = await client.query(
        `INSERT INTO orra_game_leaderboard (
      id, wallet_address, score, run_completed, display_name, twitter_handle,
      chain_id, created_at, questions_answered, correct_count, pyth_iq,
      mean_latency_ms, median_latency_ms, bosses_reached, power_ups_used, session_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (id) DO NOTHING`,
        [
          row.id,
          row.wallet_address,
          row.score,
          row.run_completed,
          row.display_name,
          row.twitter_handle,
          row.chain_id,
          row.created_at,
          row.questions_answered,
          row.correct_count,
          row.pyth_iq,
          row.mean_latency_ms,
          row.median_latency_ms,
          row.bosses_reached,
          row.power_ups_used,
          row.session_id ?? null,
        ],
      );
      if (ins.rowCount === 0) {
        return;
      }
      await setRlsVars(client, {
        leaderboard_select_all: "1",
        leaderboard_maintenance: "1",
      });
      await trimLeaderboardToMax(client, 2000);
    },
  );
}

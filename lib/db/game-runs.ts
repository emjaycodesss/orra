import { getPool } from "@/lib/db/pool";
import { withRlsContext } from "@/lib/db/with-rls-context";

export interface GameRun {
  id: string;
  wallet_address: string;
  display_name: string | null;
  twitter_handle: string | null;
  avatar_url: string | null;
  score: number;
  pyth_iq: number | null;
  accuracy: number | null;
  bosses_reached: number;
  won: boolean;
  created_at: string;
}

export async function insertGameRun(run: GameRun): Promise<void> {
  /** DB CHECK + RLS expect lowercase hex (see migrations/010_game_runs_wallet_lowercase.sql). */
  const wallet = run.wallet_address.toLowerCase();
  await withRlsContext({ wallet_address: wallet }, async (client) => {
    await client.query(
      `INSERT INTO game_runs
         (id, wallet_address, display_name, twitter_handle, avatar_url,
          score, pyth_iq, accuracy, bosses_reached, won, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        run.id,
        wallet,
        run.display_name ?? null,
        run.twitter_handle ?? null,
        run.avatar_url ?? null,
        run.score,
        run.pyth_iq ?? null,
        run.accuracy ?? null,
        run.bosses_reached,
        run.won,
        run.created_at,
      ],
    );
  });
}

/**
 * Recent runs for a wallet (newest first).
 * `SET LOCAL statement_timeout` caps query time so a bad plan cannot pin a pool connection.
 */
export async function getRunsByWallet(
  walletAddress: string,
  limit = 20,
): Promise<GameRun[]> {
  const wallet = walletAddress.toLowerCase();
  return withRlsContext({ wallet_address: wallet }, async (client) => {
    await client.query("SET LOCAL statement_timeout = '15000'");
    const r = await client.query<GameRun>(
      `SELECT id, wallet_address, display_name, twitter_handle, avatar_url,
              score, pyth_iq, accuracy::float AS accuracy, bosses_reached, won,
              created_at
       FROM game_runs
       WHERE wallet_address = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [wallet, limit],
    );
    return r.rows;
  });
}

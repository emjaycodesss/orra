import { withRlsContext } from "@/lib/db/with-rls-context";
import type { GameSession } from "@/lib/game/types";

export async function readSessionFromDb(id: string): Promise<GameSession | null> {
  return withRlsContext({ session_id: id }, async (client) => {
    const r = await client.query<{ state: GameSession }>(
      `SELECT state FROM game_sessions WHERE id = $1`,
      [id],
    );
    const row = r.rows[0];
    return row?.state ?? null;
  });
}

export async function writeSessionToDb(id: string, session: GameSession): Promise<void> {
  await withRlsContext({ session_id: id }, async (client) => {
    const stateJson = JSON.stringify(session);
    await client.query(
      `INSERT INTO game_sessions (
      id, created_at_ms, wallet_address, twitter_handle, display_name, avatar_url, phase, state, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET
      wallet_address = EXCLUDED.wallet_address,
      twitter_handle = EXCLUDED.twitter_handle,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      phase = EXCLUDED.phase,
      state = EXCLUDED.state,
      updated_at = now()`,
      [
        id,
        session.createdAt,
        session.walletAddress,
        session.twitterHandle,
        session.displayName,
        session.avatarUrl,
        session.phase,
        stateJson,
      ],
    );
  });
}

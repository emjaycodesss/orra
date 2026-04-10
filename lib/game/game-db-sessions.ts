import { withRlsContext } from "@/lib/db/with-rls-context";
import type { GameSession } from "@/lib/game/types";

function normalizeRevision(session: GameSession): GameSession {
  return {
    ...session,
    revision: Number.isFinite(session.revision) ? session.revision : 0,
    duelHeat: typeof session.duelHeat === "number" ? session.duelHeat : 0,
    lastPowerUpFeedbackAtMs:
      typeof session.lastPowerUpFeedbackAtMs === "number"
        ? session.lastPowerUpFeedbackAtMs
        : null,
  };
}

export async function readSessionFromDb(id: string): Promise<GameSession | null> {
  return withRlsContext({ session_id: id }, async (client) => {
    const r = await client.query<{ state: GameSession }>(
      `SELECT state FROM game_sessions WHERE id = $1`,
      [id],
    );
    const row = r.rows[0];
    if (!row?.state) return null;
    return normalizeRevision(row.state);
  });
}

export async function writeSessionToDb(id: string, session: GameSession): Promise<void> {
  const normalized = normalizeRevision(session);
  await withRlsContext({ session_id: id }, async (client) => {
    const stateJson = JSON.stringify(normalized);
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
        normalized.createdAt,
        normalized.walletAddress,
        normalized.twitterHandle,
        normalized.displayName,
        normalized.avatarUrl,
        normalized.phase,
        stateJson,
      ],
    );
  });
}

export async function writeSessionToDbIfRevision(
  id: string,
  session: GameSession,
  expectedRevision: number,
): Promise<boolean> {
  const next = normalizeRevision({
    ...session,
    revision: expectedRevision + 1,
  });

  return withRlsContext({ session_id: id }, async (client) => {
    const stateJson = JSON.stringify(next);
    const updated = await client.query(
      `UPDATE game_sessions
       SET wallet_address = $2,
           twitter_handle = $3,
           display_name = $4,
           avatar_url = $5,
           phase = $6,
           state = $7::jsonb,
           updated_at = now()
       WHERE id = $1
         AND COALESCE((state->>'revision')::int, 0) = $8`,
      [
        id,
        next.walletAddress,
        next.twitterHandle,
        next.displayName,
        next.avatarUrl,
        next.phase,
        stateJson,
        expectedRevision,
      ],
    );
    if ((updated.rowCount ?? 0) > 0) return true;

    if (expectedRevision !== 0) return false;

    const inserted = await client.query(
      `INSERT INTO game_sessions (
         id, created_at_ms, wallet_address, twitter_handle, display_name, avatar_url, phase, state, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now())
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        next.createdAt,
        next.walletAddress,
        next.twitterHandle,
        next.displayName,
        next.avatarUrl,
        next.phase,
        stateJson,
      ],
    );
    return (inserted.rowCount ?? 0) > 0;
  });
}

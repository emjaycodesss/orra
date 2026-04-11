/**
 * Prefer ORRA_DATABASE_URL so app DB is explicit; fall back to DATABASE_URL (Vercel/Neon convention).
 */
export function getDatabaseUrl(): string | null {
  const u = (process.env.ORRA_DATABASE_URL ?? process.env.DATABASE_URL ?? "").trim();
  return u.length > 0 ? u : null;
}

/**
 * True when `pg` backs game sessions, runs, and leaderboard (server-side only).
 * Deployed Orra should set `ORRA_DATABASE_URL` / `DATABASE_URL` (e.g. Supabase pooler); when false, game routes use `.data/orra-game/` JSON (local dev only).
 */
export function isGameDatabaseEnabled(): boolean {
  return getDatabaseUrl() !== null;
}

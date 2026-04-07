/**
 * Prefer ORRA_DATABASE_URL so app DB is explicit; fall back to DATABASE_URL (Vercel/Neon convention).
 */
export function getDatabaseUrl(): string | null {
  const u = (process.env.ORRA_DATABASE_URL ?? process.env.DATABASE_URL ?? "").trim();
  return u.length > 0 ? u : null;
}

/** True when Postgres should back game sessions + leaderboard (server-side only). */
export function isGameDatabaseEnabled(): boolean {
  return getDatabaseUrl() !== null;
}

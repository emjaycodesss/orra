-- Orra Entropy Arena leaderboard (matches lib/game/leaderboard-types.ts LeaderboardRow).
-- PostgreSQL 14+. Run migrations in order: 001 → 002 → 003 → 004 → 005 (RLS).
-- psql "$ORRA_DATABASE_URL" -f migrations/001_orra_game_leaderboard.sql

CREATE TABLE IF NOT EXISTS orra_game_leaderboard (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  score INTEGER NOT NULL,
  run_completed BOOLEAN NOT NULL DEFAULT false,
  display_name TEXT,
  twitter_handle TEXT,
  chain_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  questions_answered INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  pyth_iq INTEGER NOT NULL,
  mean_latency_ms INTEGER,
  median_latency_ms INTEGER,
  bosses_reached INTEGER NOT NULL,
  power_ups_used INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orra_game_leaderboard_score_desc
  ON orra_game_leaderboard (score DESC);

CREATE INDEX IF NOT EXISTS idx_orra_game_leaderboard_created_at_desc
  ON orra_game_leaderboard (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orra_game_leaderboard_wallet
  ON orra_game_leaderboard (wallet_address);

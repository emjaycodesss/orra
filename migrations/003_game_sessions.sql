-- Entropy Arena session blobs (mirrors lib/game/types.ts GameSession in JSONB).
-- PostgreSQL 14+. Run after 001 (leaderboard can run before or after; 004 links them).

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  created_at_ms BIGINT NOT NULL,
  wallet_address TEXT,
  twitter_handle TEXT,
  display_name TEXT,
  avatar_url TEXT,
  phase TEXT NOT NULL CHECK (phase IN ('lobby', 'running', 'ended')),
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_phase ON game_sessions (phase);
CREATE INDEX IF NOT EXISTS idx_game_sessions_wallet ON game_sessions (wallet_address);
CREATE INDEX IF NOT EXISTS idx_game_sessions_updated ON game_sessions (updated_at DESC);

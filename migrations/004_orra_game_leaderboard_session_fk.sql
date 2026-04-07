-- Link leaderboard rows to persisted game sessions (nullable for legacy / file-imported rows).
-- Requires 001 + 003 applied.

ALTER TABLE orra_game_leaderboard
  ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES game_sessions (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orra_game_leaderboard_session_id
  ON orra_game_leaderboard (session_id);

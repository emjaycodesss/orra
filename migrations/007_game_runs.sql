-- 007_game_runs.sql
-- Run history table: one row per completed/failed run (summary stats).
-- Written to at run-end alongside orra_game_leaderboard.
-- Run after 001–006.

CREATE TABLE IF NOT EXISTS game_runs (
  id              TEXT PRIMARY KEY,
  wallet_address  TEXT NOT NULL,
  display_name    TEXT,
  twitter_handle  TEXT,
  avatar_url      TEXT,
  score           INTEGER NOT NULL DEFAULT 0,
  pyth_iq         INTEGER,
  accuracy        NUMERIC(5,2),     -- percentage 0.00–100.00
  bosses_reached  INTEGER NOT NULL DEFAULT 0,
  won             BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_runs_wallet_date
  ON game_runs (wallet_address, created_at DESC);

CREATE INDEX IF NOT EXISTS game_runs_score
  ON game_runs (score DESC);

-- RLS (consistent with migrations/005_rls.sql patterns)
ALTER TABLE game_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_runs FORCE ROW LEVEL SECURITY;

-- Wallet-scoped reads for detailed run history.
DROP POLICY IF EXISTS game_runs_select_all ON game_runs;
DROP POLICY IF EXISTS game_runs_select_own ON game_runs;
CREATE POLICY game_runs_select_own
  ON game_runs FOR SELECT
  USING (
    lower(wallet_address) = lower(nullif(current_setting('orra.wallet_address', true), ''))
  );

-- Wallet-scoped inserts (same pattern as orra_game_leaderboard)
DROP POLICY IF EXISTS game_runs_insert_own ON game_runs;
CREATE POLICY game_runs_insert_own
  ON game_runs FOR INSERT
  WITH CHECK (
    lower(wallet_address) = lower(nullif(current_setting('orra.wallet_address', true), ''))
  );

-- Wallet-scoped updates
DROP POLICY IF EXISTS game_runs_update_own ON game_runs;
CREATE POLICY game_runs_update_own
  ON game_runs FOR UPDATE
  USING (
    lower(wallet_address) = lower(nullif(current_setting('orra.wallet_address', true), ''))
  )
  WITH CHECK (
    lower(wallet_address) = lower(nullif(current_setting('orra.wallet_address', true), ''))
  );

-- Grant same permissions as other tables (see 005_rls.sql)
REVOKE ALL ON game_runs FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON game_runs TO orra_app;

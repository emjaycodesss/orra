-- 009_game_runs_wallet_lower_index.sql
-- Speeds up wallet-scoped history queries that use lower(wallet_address) = lower($1),
-- matching app queries and RLS policy predicates on game_runs (see 007_game_runs.sql).

CREATE INDEX IF NOT EXISTS game_runs_lower_wallet_created_at
  ON game_runs (lower(wallet_address), created_at DESC);

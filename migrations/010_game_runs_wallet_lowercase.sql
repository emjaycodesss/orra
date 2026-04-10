-- 010_game_runs_wallet_lowercase.sql
-- Store wallet_address in lowercase only so queries use WHERE wallet_address = $1
-- and the btree index game_runs_wallet_date (007) applies without lower(column).
-- RLS compares the column to lower(GUC) once; GUC is set lowercase from the app.
-- Run after 009. Drops the functional index from 009 (redundant after this).

UPDATE game_runs
SET wallet_address = lower(wallet_address)
WHERE wallet_address IS DISTINCT FROM lower(wallet_address);

ALTER TABLE game_runs
  ADD CONSTRAINT game_runs_wallet_address_lowercase
  CHECK (wallet_address = lower(wallet_address));

DROP POLICY IF EXISTS game_runs_select_own ON game_runs;
CREATE POLICY game_runs_select_own
  ON game_runs FOR SELECT
  USING (
    wallet_address = lower(nullif(current_setting('orra.wallet_address', true), ''))
  );

DROP POLICY IF EXISTS game_runs_insert_own ON game_runs;
CREATE POLICY game_runs_insert_own
  ON game_runs FOR INSERT
  WITH CHECK (
    wallet_address = lower(nullif(current_setting('orra.wallet_address', true), ''))
  );

DROP POLICY IF EXISTS game_runs_update_own ON game_runs;
CREATE POLICY game_runs_update_own
  ON game_runs FOR UPDATE
  USING (
    wallet_address = lower(nullif(current_setting('orra.wallet_address', true), ''))
  )
  WITH CHECK (
    wallet_address = lower(nullif(current_setting('orra.wallet_address', true), ''))
  );

DROP INDEX IF EXISTS game_runs_lower_wallet_created_at;

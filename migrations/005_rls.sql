-- Row-level security for Orra game + readings tables.
-- Run after 001–004. App uses transaction-scoped GUCs (lib/db/with-rls-context.ts).
-- FORCE ROW LEVEL SECURITY applies policies even to the table owner (except superusers).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'orra_app') THEN
    CREATE ROLE orra_app NOINHERIT;
  END IF;
END
$$;

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE orra_game_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE orra_game_leaderboard FORCE ROW LEVEL SECURITY;

ALTER TABLE orra_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orra_readings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_sessions_isolation ON game_sessions;
CREATE POLICY game_sessions_isolation ON game_sessions
  FOR ALL
  USING (id = nullif(current_setting('orra.session_id', true), ''))
  WITH CHECK (id = nullif(current_setting('orra.session_id', true), ''));

DROP POLICY IF EXISTS orra_leaderboard_select_list ON orra_game_leaderboard;
CREATE POLICY orra_leaderboard_select_list ON orra_game_leaderboard
  FOR SELECT
  USING (nullif(current_setting('orra.leaderboard_select_all', true), '') = '1');

DROP POLICY IF EXISTS orra_leaderboard_insert_scoped ON orra_game_leaderboard;
CREATE POLICY orra_leaderboard_insert_scoped ON orra_game_leaderboard
  FOR INSERT
  WITH CHECK (
    lower(wallet_address) = lower(nullif(current_setting('orra.wallet_address', true), ''))
    AND (
      session_id IS NULL
      OR session_id = nullif(current_setting('orra.session_id', true), '')
    )
  );

DROP POLICY IF EXISTS orra_leaderboard_delete_maintenance ON orra_game_leaderboard;
CREATE POLICY orra_leaderboard_delete_maintenance ON orra_game_leaderboard
  FOR DELETE
  USING (nullif(current_setting('orra.leaderboard_maintenance', true), '') = '1');

DROP POLICY IF EXISTS orra_readings_wallet_select ON orra_readings;
CREATE POLICY orra_readings_wallet_select ON orra_readings
  FOR SELECT
  USING (
    lower(wallet_address) = lower(nullif(current_setting('orra.wallet_address', true), ''))
  );

DROP POLICY IF EXISTS orra_readings_wallet_write ON orra_readings;
CREATE POLICY orra_readings_wallet_write ON orra_readings
  FOR INSERT
  WITH CHECK (
    lower(wallet_address) = lower(nullif(current_setting('orra.wallet_address', true), ''))
  );

DROP POLICY IF EXISTS orra_readings_wallet_update ON orra_readings;
CREATE POLICY orra_readings_wallet_update ON orra_readings
  FOR UPDATE
  USING (
    lower(wallet_address) = lower(nullif(current_setting('orra.wallet_address', true), ''))
  )
  WITH CHECK (
    lower(wallet_address) = lower(nullif(current_setting('orra.wallet_address', true), ''))
  );

DROP POLICY IF EXISTS orra_readings_wallet_delete ON orra_readings;
CREATE POLICY orra_readings_wallet_delete ON orra_readings
  FOR DELETE
  USING (
    lower(wallet_address) = lower(nullif(current_setting('orra.wallet_address', true), ''))
  );

REVOKE ALL ON game_sessions FROM PUBLIC;
REVOKE ALL ON orra_game_leaderboard FROM PUBLIC;
REVOKE ALL ON orra_readings FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON game_sessions TO orra_app;
GRANT SELECT, INSERT, DELETE ON orra_game_leaderboard TO orra_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON orra_readings TO orra_app;

-- App DB user (non-superuser): GRANT orra_app TO your_runtime_user;

-- 008_user_profiles_public_select.sql
-- Public-read user profile summaries for the hybrid privacy model.
-- Keep INSERT/UPDATE wallet-scoped via orra.wallet_address GUC (migrations/005_rls.sql).

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_wallet_select ON user_profiles;
DROP POLICY IF EXISTS user_profiles_select_all ON user_profiles;

CREATE POLICY user_profiles_select_all
  ON user_profiles FOR SELECT
  USING (true);


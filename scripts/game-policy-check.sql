-- Hybrid policy verification checklist for game profile/run access.
-- Run manually in a SQL console connected as an admin role.

-- 1) Verify policy shape for user_profiles and game_runs.
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('user_profiles', 'game_runs')
ORDER BY tablename, policyname;

-- 2) Verify user_profiles remains publicly readable.
-- Expected: succeeds and returns rows.
SELECT wallet_address, twitter_handle, display_name, avatar_url
FROM user_profiles
LIMIT 5;

-- 3) Verify game_runs requires wallet context.
-- Expected: returns 0 rows (or errors due to RLS) without wallet GUC.
SELECT id, wallet_address, score, created_at
FROM game_runs
LIMIT 5;

-- 4) Simulate owner context and query runs.
-- Replace with a known wallet from your database.
BEGIN;
SET LOCAL orra.wallet_address = '0x0000000000000000000000000000000000000000';
SELECT id, wallet_address, score, created_at
FROM game_runs
WHERE wallet_address = lower(nullif(current_setting('orra.wallet_address', true), ''))
ORDER BY created_at DESC
LIMIT 20;
ROLLBACK;

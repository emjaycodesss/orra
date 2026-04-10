-- Game Profile Database Check & Repair Script
-- Run this in your PostgreSQL editor to diagnose profile save issues
-- All SELECT queries are safe; UPDATE queries are commented out for safety

-- 1. Check if game_sessions table exists and has RLS enabled
SELECT
  schemaname,
  tablename,
  rowsecurity,
  CASE WHEN rowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables
WHERE tablename = 'game_sessions';

-- 2. Check RLS policies on game_sessions
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'game_sessions'
ORDER BY policyname;

-- 3. Check role permissions
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'game_sessions'
ORDER BY grantee, privilege_type;

-- 4. Find most recent sessions with NULL profile data
SELECT
  id,
  created_at_ms,
  wallet_address,
  twitter_handle,
  display_name,
  avatar_url,
  phase,
  updated_at
FROM game_sessions
WHERE twitter_handle IS NULL OR display_name IS NULL OR avatar_url IS NULL
ORDER BY updated_at DESC
LIMIT 10;

-- 5. Find sessions missing wallet but have twitter handle
SELECT
  id,
  wallet_address,
  twitter_handle,
  display_name,
  avatar_url,
  phase,
  updated_at
FROM game_sessions
WHERE wallet_address IS NULL
  AND twitter_handle IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;

-- 6. Count total sessions and their completion status
SELECT
  COUNT(*) as total_sessions,
  SUM(CASE WHEN wallet_address IS NOT NULL THEN 1 ELSE 0 END) as with_wallet,
  SUM(CASE WHEN twitter_handle IS NOT NULL THEN 1 ELSE 0 END) as with_twitter,
  SUM(CASE WHEN avatar_url IS NOT NULL THEN 1 ELSE 0 END) as with_avatar,
  SUM(CASE WHEN phase = 'ended' THEN 1 ELSE 0 END) as completed_runs
FROM game_sessions;

-- 7. Check specific session (replace 'YOUR_SESSION_ID' with actual ID)
-- SELECT * FROM game_sessions WHERE id = 'YOUR_SESSION_ID';

-- REPAIR QUERIES (uncomment and modify as needed):

-- Fix 1: Update a single session with missing profile data
-- UPDATE game_sessions
-- SET
--   wallet_address = '0xYourWalletAddressHere',
--   twitter_handle = '@yourhandle',
--   display_name = 'Your Display Name',
--   avatar_url = 'https://example.com/avatar.jpg',
--   updated_at = now()
-- WHERE id = 'YOUR_SESSION_ID';

-- Fix 2: Bulk fix sessions with NULL display_name (use twitter_handle as fallback)
-- UPDATE game_sessions
-- SET
--   display_name = COALESCE(display_name, twitter_handle, 'Unknown'),
--   updated_at = now()
-- WHERE display_name IS NULL AND twitter_handle IS NOT NULL;

-- Fix 3: Set all NULL avatar_url to empty string (if your app treats NULL differently from empty)
-- UPDATE game_sessions
-- SET avatar_url = ''
-- WHERE avatar_url IS NULL;

-- Fix 4: Check data consistency in state JSONB
-- SELECT
--   id,
--   (state ->> 'twitterHandle') as state_twitter_handle,
--   twitter_handle as table_twitter_handle,
--   (state ->> 'walletAddress') as state_wallet,
--   wallet_address as table_wallet,
--   (state ->> 'displayName') as state_display_name,
--   display_name as table_display_name
-- FROM game_sessions
-- WHERE state IS NOT NULL
-- LIMIT 5;

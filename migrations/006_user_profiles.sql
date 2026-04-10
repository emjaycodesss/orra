-- User profiles: persist Twitter handle, display name, avatar across game sessions.
-- Profiles are linked to wallet address so users see their profile in any new session.

CREATE TABLE IF NOT EXISTS user_profiles (
  wallet_address TEXT PRIMARY KEY,
  twitter_handle TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_updated ON user_profiles (updated_at DESC);

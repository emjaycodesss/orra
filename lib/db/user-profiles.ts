import { getPool } from "@/lib/db/pool";
import { withRlsContext } from "@/lib/db/with-rls-context";

interface UserProfile {
  walletAddress: string;
  twitterHandle: string;
  displayName: string | null;
  avatarUrl: string | null;
  updatedAt: string;
}

/**
 * Wagmi / clients often send EIP-55 checksummed addresses; profile-restore uses lowercase.
 * RLS already compares with `lower(wallet_address)`; the SELECT must match that or restores miss rows.
 */
export async function getUserProfile(walletAddress: string): Promise<UserProfile | null> {
  const w = walletAddress.toLowerCase();
  const pool = getPool();
  const r = await pool.query<{
    wallet_address: string;
    twitter_handle: string;
    display_name: string | null;
    avatar_url: string | null;
    updated_at: string;
  }>(
    `SELECT wallet_address, twitter_handle, display_name, avatar_url, updated_at
     FROM user_profiles
     WHERE LOWER(wallet_address) = $1`,
    [w],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    walletAddress: row.wallet_address,
    twitterHandle: row.twitter_handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    updatedAt: row.updated_at,
  };
}

/**
 * Upsert by wallet. UPDATE-by-LOWER matches legacy checksummed PK rows; INSERT stores lowercase.
 */
export async function saveUserProfile(
  walletAddress: string,
  twitterHandle: string,
  displayName: string | null,
  avatarUrl: string | null,
): Promise<void> {
  const w = walletAddress.toLowerCase();
  await withRlsContext({ wallet_address: w }, async (client) => {
    const updated = await client.query(
      `UPDATE user_profiles
       SET twitter_handle = $2, display_name = $3, avatar_url = $4, updated_at = now()
       WHERE LOWER(wallet_address) = $1`,
      [w, twitterHandle, displayName, avatarUrl],
    );
    if (updated.rowCount && updated.rowCount > 0) return;
    await client.query(
      `INSERT INTO user_profiles (wallet_address, twitter_handle, display_name, avatar_url, updated_at)
       VALUES ($1, $2, $3, $4, now())`,
      [w, twitterHandle, displayName, avatarUrl],
    );
  });
}

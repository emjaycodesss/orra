import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-observability";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { getUserProfile } from "@/lib/db/user-profiles";
import { normalizeWalletAddress, parseJsonBody } from "@/lib/game/api-route-helpers";

export async function POST(req: Request) {
  const parsed = await parseJsonBody<{ walletAddress?: string }>(req);
  if (parsed instanceof NextResponse) return parsed;
  const wallet = normalizeWalletAddress(parsed.walletAddress);

  if (!wallet) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }

  try {
    const profile = await getUserProfile(wallet);
    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    return NextResponse.json({
      profile: {
        handle: profile.twitterHandle,
        displayName: profile.displayName,
        avatarUrl: normalizeAvatarUrl(profile.avatarUrl),
      },
    });
  } catch (err) {
    logApiError("api/game/profile-by-wallet", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}

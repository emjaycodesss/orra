import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-observability";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { readSessionFile, writeSessionFile } from "@/lib/game/fs-store";
import { stripSecretAnswers } from "@/lib/game/http-session";
import { writeSessionToDb } from "@/lib/game/game-db-sessions";
import { getUserProfile } from "@/lib/db/user-profiles";
import {
  normalizeWalletAddress,
  parseJsonBody,
  requireGameSession,
} from "@/lib/game/api-route-helpers";

export async function POST(req: Request) {
  const sessionResult = await requireGameSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const { sessionId: id, session } = sessionResult;

  const parsed = await parseJsonBody<{ walletAddress?: string }>(req);
  if (parsed instanceof NextResponse) return parsed;
  const wallet = normalizeWalletAddress(parsed.walletAddress);

  if (!wallet) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  const sessionWallet = normalizeWalletAddress(session.walletAddress);
  if (sessionWallet && sessionWallet !== wallet) {
    return NextResponse.json({ error: "wallet_mismatch" }, { status: 403 });
  }

  try {
    const profile = await getUserProfile(wallet);
    /**
     * No row yet is normal (first visit / DB not wired). Use 200 — not 404 — so dev/proxy logs
     * do not look like a missing route and clients can treat this as "nothing to restore".
     * Mirrors `profile-by-wallet` returning `{ profile: null }` with 200.
     */
    if (!profile) {
      return NextResponse.json({ restored: false, reason: "no_profile" as const }, { status: 200 });
    }

    const updated = {
      ...session,
      walletAddress: wallet,
      twitterHandle: profile.twitterHandle,
      displayName: profile.displayName,
      avatarUrl: normalizeAvatarUrl(profile.avatarUrl),
    };

    try {
      await writeSessionFile(id, updated);
    } catch {}

    try {
      await writeSessionToDb(id, updated);
    } catch {}

    return NextResponse.json({
      restored: true as const,
      session: stripSecretAnswers(updated),
    });
  } catch (err) {
    logApiError("api/game/profile-restore", err);
    return NextResponse.json({ error: "restore_failed" }, { status: 500 });
  }
}

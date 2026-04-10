import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-observability";
import { getRunsByWallet } from "@/lib/db/game-runs";
import { normalizeWalletAddress, requireGameSession } from "@/lib/game/api-route-helpers";

export async function GET(req: Request) {
  const sessionResult = await requireGameSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const sessionWallet = normalizeWalletAddress(sessionResult.session.walletAddress);
  if (!sessionWallet) {
    return NextResponse.json({ error: "wallet_missing_in_session" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestedWallet = searchParams.get("wallet");
  const wallet = requestedWallet
    ? normalizeWalletAddress(requestedWallet)
    : sessionWallet;

  if (!wallet) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }
  if (wallet !== sessionWallet) {
    return NextResponse.json({ error: "wallet_mismatch" }, { status: 403 });
  }

  try {
    const runs = await getRunsByWallet(wallet, 20);
    return NextResponse.json({ runs });
  } catch (err) {
    logApiError("api/game/runs", err, { wallet });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionFile } from "@/lib/game/fs-store";
import { GAME_SESSION_COOKIE } from "@/lib/game/http-session";
import {
  appendLeaderboard,
  loadLeaderboard,
  type LeaderboardRow,
} from "@/lib/game/leaderboard-file";
import { computePythIq } from "@/lib/game/pythIq";

function median(ns: number[]): number | null {
  if (ns.length === 0) return null;
  const s = [...ns].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export async function POST(req: Request) {
  const jar = await cookies();
  const id = jar.get(GAME_SESSION_COOKIE)?.value;
  if (!id) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }
  const session = await readSessionFile(id);
  if (!session || session.phase !== "ended") {
    return NextResponse.json({ error: "not_ended" }, { status: 400 });
  }

  let body: { walletAddress?: string; chainId?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const wallet = body.walletAddress?.toLowerCase();
  if (!wallet || !wallet.startsWith("0x") || wallet.length !== 42) {
    return NextResponse.json({ error: "wallet" }, { status: 400 });
  }
  if (session.walletAddress && session.walletAddress.toLowerCase() !== wallet) {
    return NextResponse.json({ error: "wallet_mismatch" }, { status: 403 });
  }

  const chainId =
    typeof body.chainId === "number" && Number.isFinite(body.chainId)
      ? body.chainId
      : 84532;

  const runKey = `${session.id}:${session.createdAt}`;
  const existing = await loadLeaderboard();
  if (existing.some((r) => r.id === runKey)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const latencies = session.answerLog.map((e) => e.latencyMs).filter((n) => n > 0);
  const meanLat =
    latencies.length === 0
      ? null
      : latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const medLat = median(latencies);
  const correctCount = session.answerLog.filter((e) => e.correct).length;
  const iq = computePythIq(
    session.answerLog.map((e) => ({ correct: e.correct, bossIndex: e.bossIndex })),
  );

  const row: LeaderboardRow = {
    id: runKey,
    wallet_address: wallet,
    score: session.runScore,
    run_completed: session.bossesDefeated >= 3,
    display_name: session.displayName,
    twitter_handle: session.twitterHandle,
    chain_id: chainId,
    created_at: new Date().toISOString(),
    questions_answered: session.answerLog.length,
    correct_count: correctCount,
    pyth_iq: iq,
    mean_latency_ms: meanLat === null ? null : Math.round(meanLat),
    median_latency_ms: medLat === null ? null : Math.round(medLat),
    bosses_reached: session.bossesReached,
    power_ups_used: session.powerUpsUsed,
    session_id: session.id,
  };

  await appendLeaderboard(row);
  return NextResponse.json({ ok: true });
}

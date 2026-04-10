import { NextResponse } from "next/server";
import {
  appendLeaderboard,
  loadLeaderboard,
  type LeaderboardRow,
} from "@/lib/game/leaderboard-file";
import { computePythIq } from "@/lib/game/pythIq";
import { insertGameRun } from "@/lib/db/game-runs";
import {
  normalizeWalletAddress,
  parseJsonBody,
  requireGameSession,
} from "@/lib/game/api-route-helpers";

function median(ns: number[]): number | null {
  if (ns.length === 0) return null;
  const s = [...ns].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export async function POST(req: Request) {
  const sessionResult = await requireGameSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const { session } = sessionResult;
  if (session.phase !== "ended") {
    return NextResponse.json({ error: "not_ended" }, { status: 400 });
  }

  const parsed = await parseJsonBody<{ walletAddress?: string; chainId?: number }>(req);
  if (parsed instanceof NextResponse) return parsed;
  const wallet = normalizeWalletAddress(parsed.walletAddress);
  if (!wallet) {
    return NextResponse.json({ error: "wallet" }, { status: 400 });
  }
  const sessionWallet = normalizeWalletAddress(session.walletAddress);
  if (!sessionWallet) {
    return NextResponse.json({ error: "wallet_missing_in_session" }, { status: 403 });
  }
  if (sessionWallet !== wallet) {
    return NextResponse.json({ error: "wallet_mismatch" }, { status: 403 });
  }

  const chainId =
    typeof parsed.chainId === "number" && Number.isFinite(parsed.chainId)
      ? parsed.chainId
      : 84532;

  /**
   * `revision` increments on each persisted session write and is monotonic; it identifies
   * each snapshot at run end. After start-run, each completed run gets a unique key
   * `sessionId:revision` because ending a run bumps revision.
   */
  const runKey = `${session.id}:${session.revision ?? 0}`;
  const existing = await loadLeaderboard();
  if (existing.some((r) => r.id === runKey)) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const serverScore = Math.max(0, session.runScore ?? 0);

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
    score: serverScore,
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

  let runPersisted = true;
  try {
    const totalQuestions = session.answerLog.length;
    const accuracy =
      totalQuestions > 0
        ? Math.round((correctCount / totalQuestions) * 10000) / 100
        : null;
    await insertGameRun({
      id: runKey,
      wallet_address: wallet,
      display_name: session.displayName ?? null,
      twitter_handle: session.twitterHandle ?? null,
      avatar_url: null,
      score: serverScore,
      pyth_iq: iq,
      accuracy,
      bosses_reached: session.bossesReached,
      won: session.bossesDefeated >= 3,
      created_at: new Date().toISOString(),
    });
  } catch {
    runPersisted = false;
  }

  return NextResponse.json({ ok: true, runPersisted });
}

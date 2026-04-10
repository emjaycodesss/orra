import { NextResponse } from "next/server";
import {
  loadLeaderboard,
  leaderboardStats,
  percentileBelow,
  rankByScore,
} from "@/lib/game/leaderboard-file";

/** Leaderboard-backed stats must never be served from a stale static cache. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scoreParam = url.searchParams.get("score");
  const rows = await loadLeaderboard();
  const stats = leaderboardStats(rows);
  const score = scoreParam != null ? Number(scoreParam) : NaN;
  const frontrunPct =
    Number.isFinite(score) && rows.length >= 20
      ? percentileBelow(score, rows)
      : null;
  const deltaPct =
    Number.isFinite(score) && stats.meanScore > 0
      ? Math.round(((score - stats.meanScore) / stats.meanScore) * 100)
      : null;
  const leaderboardRank =
    Number.isFinite(score) && rows.length > 0 ? rankByScore(score, rows) : null;

  return NextResponse.json({
    meanScore: Math.round(stats.meanScore * 100) / 100,
    medianScore: Math.round(stats.medianScore * 100) / 100,
    submissionCount: stats.submissionCount,
    frontrunPct,
    deltaPct,
    leaderboardRank,
    sampleReady: rows.length >= 20,
  });
}

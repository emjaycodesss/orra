import { NextResponse } from "next/server";
import {
  loadLeaderboard,
  leaderboardStats,
  percentileBelow,
} from "@/lib/game/leaderboard-file";

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

  return NextResponse.json({
    meanScore: Math.round(stats.meanScore * 100) / 100,
    medianScore: Math.round(stats.medianScore * 100) / 100,
    submissionCount: stats.submissionCount,
    frontrunPct,
    deltaPct,
    sampleReady: rows.length >= 20,
  });
}

import { NextResponse } from "next/server";
import { loadLeaderboard } from "@/lib/game/leaderboard-file";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const rows = await loadLeaderboard();
  const sorted = [...rows].sort((a, b) => b.score - a.score).slice(0, limit);
  return NextResponse.json({ rows: sorted });
}

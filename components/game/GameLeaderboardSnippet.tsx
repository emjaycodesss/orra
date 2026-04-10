"use client";

import { useState } from "react";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { LeaderboardTable } from "@/components/game/LeaderboardTable";
import type { LeaderboardRow } from "@/lib/game/leaderboard-types";

export function GameLeaderboardSnippet() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useReactiveEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/game/leaderboard?limit=15", { credentials: "include" });
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as { rows: LeaderboardRow[] };
        if (!cancelled) setRows(j.rows ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="w-full">
      <LeaderboardTable leaderboard={rows} loading={loading} />
    </div>
  );
}

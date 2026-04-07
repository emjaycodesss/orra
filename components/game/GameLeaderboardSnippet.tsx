"use client";

import { useState } from "react";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";

interface Row {
  display_name: string | null;
  score: number;
  pyth_iq: number;
  twitter_handle: string | null;
}

export function GameLeaderboardSnippet() {
  const [rows, setRows] = useState<Row[]>([]);

  useReactiveEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/game/leaderboard?limit=8", { credentials: "include" });
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as { rows: Row[] };
        if (!cancelled) setRows(j.rows ?? []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows.length === 0) return null;

  return (
    <div className="card-surface card-surface-static rounded-2xl border border-[var(--surface-3)] p-5 shadow-[0_12px_40px_rgba(9,4,18,0.22)] sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">Leaderboard</p>
      <h3 className="mt-1 font-sans text-[15px] font-medium text-ink-900">Top runs</h3>
      <ol className="mt-4 space-y-2.5 text-sm">
        {rows.map((row, i) => (
          <li
            key={`${row.display_name ?? ""}-${row.score}-${i}`}
            className="flex justify-between gap-3 border-b border-[var(--surface-3)] pb-2.5 last:border-0 last:pb-0"
          >
            <span className="min-w-0 truncate text-[13px] font-medium text-ink-700">
              <span className="mr-2 tabular text-ink-400">{i + 1}.</span>
              {row.display_name ?? row.twitter_handle ?? "Player"}
            </span>
            <span className="shrink-0 tabular text-[13px] font-semibold text-ink-900">
              {row.score}{" "}
              <span className="ml-1 text-xs font-normal text-ink-400">IQ {row.pyth_iq}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

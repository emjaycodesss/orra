"use client";

import { Calendar, TrendingUp } from "lucide-react";
import type { GameRun } from "@/lib/db/game-runs";

interface RecapHistoryProps {
  pastRuns: GameRun[];
  loading?: boolean;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function RecapHistory({ pastRuns, loading = false }: RecapHistoryProps) {
  if (loading) {
    return (
      <div className="space-y-3 font-manrope">
        <div className="card-surface recap-card-static rounded-xl border border-[var(--surface-3)] p-4 sm:p-5 backdrop-blur-sm">
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="rounded-lg p-4 animate-pulse"
                style={{
                  background: "linear-gradient(135deg, var(--surface-3) 0%, var(--surface-2) 100%)",
                  opacity: 1 - i * 0.15,
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded bg-[var(--surface-4)] w-32" />
                    <div className="h-3 rounded bg-[var(--surface-4)] w-24" />
                  </div>
                  <div className="shrink-0 space-y-1 text-right">
                    <div className="h-4 rounded bg-[var(--surface-4)] w-16" />
                    <div className="h-3 rounded bg-[var(--surface-4)] w-12" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (pastRuns.length === 0) {
    return (
      <div className="card-surface recap-card-static rounded-xl border border-[var(--surface-3)] p-4 sm:p-5 backdrop-blur-sm text-center">
        <p className="text-sm text-ink-500 font-manrope">
          No past runs yet. Complete a run to see history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 font-manrope">
      <div className="card-surface recap-card-static rounded-xl border border-[var(--surface-3)] p-4 sm:p-5 backdrop-blur-sm">
        <div className="space-y-2">
          {pastRuns.map((run) => (
            <div
              key={run.id}
              className="w-full text-left rounded-lg p-4"
              style={{
                background: "linear-gradient(135deg, var(--surface-3) 0%, var(--surface-2) 100%)",
                boxShadow: `
                  0 10px 25px rgba(0, 0, 0, 0.25),
                  0 4px 8px rgba(0, 0, 0, 0.15),
                  inset 0 1px 0 rgba(255, 255, 255, 0.08),
                  inset 0 -2px 4px rgba(0, 0, 0, 0.2)
                `,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-ink-500 shrink-0" />
                    <p className="text-xs text-ink-500 font-manrope">
                      {formatDate(run.created_at)}
                    </p>
                  </div>
                  {run.accuracy != null && (
                    <p className="text-xs text-ink-600 font-manrope">
                      {Math.round(run.accuracy)}% accuracy
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1 mb-0.5">
                    <TrendingUp size={14} className="text-accent-light" />
                    <span className="text-sm font-semibold text-accent-light font-manrope">
                      {run.score}
                    </span>
                  </div>
                  {run.pyth_iq != null && (
                    <p className="text-xs text-ink-500 font-manrope">IQ: {run.pyth_iq}</p>
                  )}
                </div>
              </div>

              <div className="mt-2 inline-flex items-center gap-1 text-xs bg-accent-light/10 text-accent-light px-2 py-1 rounded font-manrope font-medium">
                {run.bosses_reached}/3 bosses · {run.won ? "Won" : "Lost"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

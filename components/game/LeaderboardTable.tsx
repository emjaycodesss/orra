"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LeaderboardRow } from "@/lib/game/leaderboard-types";
import {
  deduplicateLeaderboard,
  paginateLeaderboard,
} from "@/lib/game/recap-helpers";

const PAGE_SIZE = 15;

interface LeaderboardTableProps {
  leaderboard: LeaderboardRow[];
  loading: boolean;
}

export function LeaderboardTable({
  leaderboard,
  loading,
}: LeaderboardTableProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const gridCols = "0.9fr 1.55fr 0.7fr 1fr";

  const dedupedLeaderboard = deduplicateLeaderboard(leaderboard);

  const pagination = paginateLeaderboard(dedupedLeaderboard, currentPage, PAGE_SIZE);

  if (loading) {
    return (
      <div className="card-surface recap-card-static rounded-xl border border-[var(--surface-3)] p-4 sm:p-5 backdrop-blur-sm">
        <div className="grid gap-0 pb-3 mb-3" style={{ gridTemplateColumns: gridCols }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-2 sm:px-4 h-4 rounded bg-[var(--surface-3)] animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl animate-pulse"
              style={{
                display: 'grid',
                gridTemplateColumns: gridCols,
                gap: 0,
                background: 'var(--surface-3)',
                opacity: 1 - i * 0.08,
              }}
            >
              {[...Array(4)].map((_, j) => (
                <div key={j} className="px-2 sm:px-4 py-3 sm:py-4">
                  <div className="h-4 rounded bg-[var(--surface-4)]" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (dedupedLeaderboard.length === 0) {
    return (
      <div className="rounded-2xl p-8 text-center" style={{
        background: "linear-gradient(135deg, var(--surface-2) 0%, var(--surface-1) 100%)",
        boxShadow: `
          0 20px 40px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.05),
          inset 0 -1px 0 rgba(0, 0, 0, 0.3)
        `
      }}>
        <p className="text-sm text-ink-500 font-manrope">No submissions yet</p>
      </div>
    );
  }

  const { rows: pageRows, totalPages, currentPage: displayPage } = pagination;

  const startRank = displayPage * PAGE_SIZE + 1;

  return (
    <div className="space-y-4">
      <div className="card-surface recap-card-static rounded-xl border border-[var(--surface-3)] p-4 sm:p-5 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid gap-0 pb-3 mb-3" style={{ gridTemplateColumns: gridCols }}>
          <div className="px-2 sm:px-4 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.06em] sm:tracking-wider text-ink-400 font-manrope">Rank</div>
          <div className="px-2 sm:px-4 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.06em] sm:tracking-wider text-ink-400 font-manrope">X Handle</div>
          <div className="px-2 sm:px-4 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.06em] sm:tracking-wider text-ink-400 font-manrope">IQ</div>
          <div className="px-2 sm:px-4 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.06em] sm:tracking-wider text-ink-400 font-manrope">Score</div>
        </div>

        <div className="space-y-3">
          {pageRows.map((row, i) => {
            const rank = startRank + i;
            const handle =
              row.twitter_handle ?? "Anonymous";

            return (
              <div
                key={`${row.wallet_address}-${row.id}`}
                className="rounded-xl p-0 animate-in fade-in slide-in-from-left-4 duration-300"
                style={{
                  animationDelay: `${i * 50}ms`,
                  background: "linear-gradient(135deg, var(--surface-3) 0%, var(--surface-2) 100%)",
                  boxShadow: `
                    0 10px 25px rgba(0, 0, 0, 0.25),
                    0 4px 8px rgba(0, 0, 0, 0.15),
                    inset 0 1px 0 rgba(255, 255, 255, 0.08),
                    inset 0 -2px 4px rgba(0, 0, 0, 0.2)
                  `,
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  gap: 0,
                  alignItems: 'center'
                }}
              >
                <div className="px-2 sm:px-4 py-3 sm:py-4">
                  <span className="text-base sm:text-lg font-bold text-accent-light rank-number font-manrope whitespace-nowrap">
                    #{rank}
                  </span>
                </div>

                <div className="px-2 sm:px-4 py-3 sm:py-4 min-w-0">
                  <p className="text-[13px] sm:text-sm font-semibold text-ink-900 truncate font-manrope">
                    {handle}
                  </p>
                </div>

                <div className="px-2 sm:px-4 py-3 sm:py-4">
                  <p className="text-[13px] sm:text-sm text-ink-500 font-manrope whitespace-nowrap">
                    {row.pyth_iq}
                  </p>
                </div>

                <div className="px-2 sm:px-4 py-3 sm:py-4">
                  <span className="text-[13px] sm:text-sm font-semibold text-accent-light score-number font-manrope whitespace-nowrap">
                    {row.score}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(0, displayPage - 1))}
            disabled={displayPage === 0}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-[var(--surface-3)] text-ink-700 font-medium text-sm transition-all duration-300 hover:border-[var(--surface-4)] hover:text-ink-900 active:bg-[var(--surface-1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--surface-3)] disabled:hover:text-ink-700 font-manrope"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} aria-hidden />
            Previous
          </button>

          <div className="text-sm text-ink-500 font-manrope">
            Page {displayPage + 1} of {totalPages}
          </div>

          <button
            type="button"
            onClick={() =>
              setCurrentPage(Math.min(totalPages - 1, displayPage + 1))
            }
            disabled={displayPage >= totalPages - 1}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-[var(--surface-3)] text-ink-700 font-medium text-sm transition-all duration-300 hover:border-[var(--surface-4)] hover:text-ink-900 active:bg-[var(--surface-1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--surface-3)] disabled:hover:text-ink-700 font-manrope"
            aria-label="Next page"
          >
            Next
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-in {
          animation: fadeIn 0.3s ease-out forwards;
        }

        .slide-in-from-left-4 {
          animation: slideInFromLeft 0.3s ease-out forwards;
        }

        .rank-number,
        .score-number {
          font-variant-numeric: tabular-nums;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-in,
          .slide-in-from-left-4 {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { X } from "lucide-react";
import type { GameSession } from "@/lib/game/types";
import { computePythIq } from "@/lib/game/pythIq";
import { downloadSessionRecapPng } from "@/lib/export-session-recap-png";
import {
  OracleBackGlyph,
  OracleReadyGlyph,
  ReadingOracleNavCta,
} from "@/components/reading/ReadingWalletHud";

type PublicSession = Omit<GameSession, "currentQuestionAnswer">;

interface GlobalStats {
  meanScore: number;
  medianScore: number;
  submissionCount: number;
  frontrunPct: number | null;
  deltaPct: number | null;
  sampleReady: boolean;
}

export function SessionRecapModal({
  session,
  open,
  onClose,
  walletAddress,
}: {
  session: PublicSession;
  open: boolean;
  onClose: () => void;
  walletAddress: string | null;
}) {
  const [stats, setStats] = useState<GlobalStats | null>(null);

  useReactiveEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/game/stats/global?score=${encodeURIComponent(String(session.runScore))}`,
          { credentials: "include" },
        );
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as GlobalStats;
        if (!cancelled) setStats(j);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, session.runScore]);

  const iq = computePythIq(
    session.answerLog.map((e) => ({ correct: e.correct, bossIndex: e.bossIndex })),
  );
  const correctCount = session.answerLog.filter((e) => e.correct).length;

  const handleDownload = useCallback(() => {
    downloadSessionRecapPng({
      displayName: session.displayName,
      walletAddress,
      runScore: session.runScore,
      pythIq: iq,
      bossesDefeated: session.bossesDefeated,
      bossesReached: session.bossesReached,
      correctCount,
      questionsAnswered: session.answerLog.length,
      frontrunPct: stats?.frontrunPct ?? null,
      deltaPct: stats?.deltaPct ?? null,
    });
  }, [
    session,
    walletAddress,
    iq,
    correctCount,
    stats?.frontrunPct,
    stats?.deltaPct,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-900/45 backdrop-blur-[2px] sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recap-title"
    >
      <div className="card-surface card-surface-static flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-[var(--surface-3)] shadow-[0_12px_40px_rgba(9,4,18,0.28)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--surface-3)] p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">Recap</p>
            <h2 id="recap-title" className="reading-approach-lede mt-1 font-sans text-lg font-light text-ink-900 sm:text-xl">
              Session recap
            </h2>
            <p className="reading-approach-sub mt-2 font-sans text-[12px] font-medium leading-relaxed text-ink-600">
              Scores and stats only — no win/loss verdict copy.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/30 bg-gradient-to-b from-white/26 to-white/10 text-ink-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-8px_14px_rgba(255,255,255,0.05),0_10px_24px_rgba(9,4,18,0.32)] backdrop-blur-xl transition-all duration-300 hover:border-white/45 hover:from-white/34 hover:to-white/16 hover:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-400/55"
            aria-label="Close recap"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 text-ink-700 sm:p-6 sm:pt-0">
          <dl className="grid grid-cols-1 gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[var(--surface-3)] pb-2">
              <dt className="text-ink-500">Run score</dt>
              <dd className="font-semibold tabular text-ink-900">{session.runScore}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--surface-3)] pb-2">
              <dt className="text-ink-500">Pyth IQ</dt>
              <dd className="font-semibold tabular text-ink-900">{iq}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--surface-3)] pb-2">
              <dt className="text-ink-500">Boss progress</dt>
              <dd className="font-semibold tabular text-ink-900">
                {session.bossesDefeated} cleared · {session.bossesReached} reached
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--surface-3)] pb-2">
              <dt className="text-ink-500">Accuracy</dt>
              <dd className="font-semibold tabular text-ink-900">
                {correctCount} / {session.answerLog.length} correct
              </dd>
            </div>
          </dl>

          {stats && (
            <div className="card-surface rounded-xl border border-[var(--surface-3)] bg-[var(--surface-2)]/70 p-4 text-[13px] leading-relaxed text-ink-600">
              <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                Leaderboard context
              </p>
              <p className="tabular text-ink-700">
                Mean {stats.meanScore} · Median {stats.medianScore} · {stats.submissionCount} runs
              </p>
              {stats.sampleReady && stats.frontrunPct != null && (
                <p className="mt-2">
                  Your score is strictly ahead of {stats.frontrunPct}% of submitted runs.
                </p>
              )}
              {!stats.sampleReady && (
                <p className="mt-2 text-ink-500">
                  Frontrun percentile unlocks after 20+ leaderboard submissions.
                </p>
              )}
              {stats.deltaPct != null && (
                <p className="mt-1">
                  Versus mean: {stats.deltaPct >= 0 ? "+" : ""}
                  {stats.deltaPct}%
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 p-5 pt-0 sm:flex-row sm:px-6 sm:pb-6">
          <ReadingOracleNavCta
            label="Download PNG"
            ariaLabel="Download recap as PNG"
            onClick={handleDownload}
            glyph={<OracleReadyGlyph />}
            className="reading-nav-oracle-cta--no-pulse min-h-11 flex-1 justify-center"
          />
          <ReadingOracleNavCta
            label="Done"
            ariaLabel="Close recap"
            onClick={onClose}
            glyph={<OracleBackGlyph />}
            className="reading-nav-oracle-cta--no-pulse min-h-11 flex-1 justify-center"
          />
        </div>
      </div>
    </div>
  );
}

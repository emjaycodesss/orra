"use client";

import { useCallback, useRef, useState } from "react";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { useMountEffect } from "@/hooks/useMountEffect";
import {
  Trophy,
  Download,
  CheckCircle,
  XCircle,
  Check,
  TrendingUp,
  TrendingDown,
  Zap,
  X,
} from "lucide-react";
import { MdFileDownload, MdReplay } from "react-icons/md";
import { FaXTwitter } from "react-icons/fa6";
import type { GameSession } from "@/lib/game/types";
import type { LeaderboardRow } from "@/lib/game/leaderboard-types";
import type { GameRun } from "@/lib/db/game-runs";
import { computePythIq } from "@/lib/game/pythIq";
import { downloadSessionRecapPng } from "@/lib/export-session-recap-png";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import { ReadingOracleNavCta } from "@/components/reading/ReadingWalletHud";
import { AnimatedCounter } from "@/components/game/AnimatedCounter";
import { LeaderboardTable } from "@/components/game/LeaderboardTable";
import { QuestionsContainer } from "@/components/game/QuestionsContainer";
import { RecapHistory } from "@/components/game/RecapHistory";
import { useReadingAudio } from "@/components/reading/ReadingAudioProvider";

type PublicSession = Omit<GameSession, "currentQuestionAnswer">;

interface GlobalStats {
  meanScore: number;
  medianScore: number;
  submissionCount: number;
  frontrunPct: number | null;
  deltaPct: number | null;
  /** 1-based placement if this run score were on the full leaderboard (ties share rank). */
  leaderboardRank: number | null;
  sampleReady: boolean;
}

type TabType = "leaderboard" | "questions" | "history";

function buildTriviaShareText(runScore: number, pythIq: number, bossesDefeated: number): string {
  return `I just scored ${runScore} in Orra Trivia Clash! 👁️ Pyth IQ: ${pythIq}. ${bossesDefeated}/3 guardians defeated. #OrraTriviaClash #Pyth`;
}

const WIN_HEADLINES = [
  "GG, Oracle Breaker",
  "Flawless Clash Energy",
  "Guardian Slayer, GG",
  "Victory Logged in the Stars",
  "You Cooked That Run",
] as const;

const LOSS_HEADLINES = [
  "GG, Close Fight",
  "Solid Run, Run It Back",
  "Almost There, Seeker",
  "You Landed Some Heavy Hits",
  "Respectable Clash, Keep Pushing",
] as const;

/**
 * Run recap: stats, leaderboard, PNG export, past runs. Duel BGM stops on unmount; ambient continues until route change.
 * Wallet changes abort in-flight history fetches and clear rows (prefetch reloads).
 */
export function GameRecapPage({
  session,
  walletAddress,
  leaderboardRefreshNonce = 0,
  onNewSession,
  onBackToPortal,
}: {
  session: PublicSession;
  walletAddress: string | null;
  /**
   * Parent increments after a successful leaderboard submit so we refetch `/api/game/leaderboard`
   * (the first fetch often races ahead of the POST).
   */
  leaderboardRefreshNonce?: number;
  onNewSession: () => void;
  onBackToPortal: () => void;
}) {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("leaderboard");
  const [pastRuns, setPastRuns] = useState<GameRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyLoadGenRef = useRef(0);
  const historyFetchAbortRef = useRef<AbortController | null>(null);
  const audio = useReadingAudio();

  useMountEffect(() => {
    audio?.primeGameAudio();
    void audio?.preloadGameAudio();
    audio?.startGameLoop();
    return () => audio?.stopGameLoop();
  });

  useReactiveEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [statsRes, leaderboardRes] = await Promise.all([
          fetch(
            `/api/game/stats/global?score=${encodeURIComponent(String(session.runScore))}`,
            { credentials: "include" },
          ),
          fetch("/api/game/leaderboard?limit=8", { credentials: "include" }),
        ]);

        if (cancelled) return;

        if (statsRes.ok) {
          const statsData = (await statsRes.json()) as GlobalStats;
          if (!cancelled) setStats(statsData);
        }

        if (leaderboardRes.ok) {
          const leaderboardData = (await leaderboardRes.json()) as { rows: LeaderboardRow[] };
          if (!cancelled) setLeaderboard(leaderboardData.rows ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session.runScore, leaderboardRefreshNonce]);

  useReactiveEffect(() => {
    historyFetchAbortRef.current?.abort();
    setPastRuns([]);
    setHistoryError(null);
    setHistoryLoading(false);
  }, [walletAddress]);

  const loadPastRuns = useCallback(async () => {
    if (!walletAddress) return;
    historyFetchAbortRef.current?.abort();
    const gen = ++historyLoadGenRef.current;
    const ac = new AbortController();
    historyFetchAbortRef.current = ac;
    const timeoutId = window.setTimeout(() => {
      ac.abort();
    }, 12_000);
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/game/runs?wallet=${encodeURIComponent(walletAddress)}`,
        { credentials: "include", signal: ac.signal },
      );
      window.clearTimeout(timeoutId);
      if (gen !== historyLoadGenRef.current) return;
      if (!res.ok) {
        setHistoryError("Could not load run history. Try again.");
        return;
      }
      const data = (await res.json()) as { runs: GameRun[] };
      setPastRuns(data.runs ?? []);
      setHistoryError(null);
    } catch (e: unknown) {
      window.clearTimeout(timeoutId);
      if (gen !== historyLoadGenRef.current) return;
      const aborted =
        ac.signal.aborted ||
        (e instanceof DOMException && e.name === "AbortError") ||
        (typeof e === "object" && e !== null && "name" in e && (e as { name?: string }).name === "AbortError");
      if (aborted) {
        setHistoryError("History is taking too long to load. Check your connection and try again.");
      } else {
        setHistoryError("Could not load run history. Try again.");
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (gen === historyLoadGenRef.current) {
        setHistoryLoading(false);
        historyFetchAbortRef.current = null;
      }
    }
  }, [walletAddress]);

  /**
   * Prefetch run history as soon as the recap has a wallet (not only when History tab opens).
   * Perceived latency drops because data is often ready before the user switches tabs.
   * `leaderboardRefreshNonce` bumps after a successful `/api/game/leaderboard/submit` (which also
   * inserts the run row); without refetching here, History can race the submit like the leaderboard tab.
   */
  useReactiveEffect(() => {
    if (!walletAddress) return;
    void loadPastRuns();
  }, [walletAddress, loadPastRuns, leaderboardRefreshNonce]);

  const iq = computePythIq(
    session.answerLog.map((e) => ({ correct: e.correct, bossIndex: e.bossIndex })),
  );
  const correctCount = session.answerLog.filter((e) => e.correct).length;
  const thinkingSeconds = Math.round(
    session.answerLog.reduce((sum, entry) => sum + Math.max(0, entry.latencyMs || 0), 0) / 1000,
  );
  const revealSeconds = session.answerLog.length * 3;
  const introSeconds = Math.max(1, session.bossesReached) * 3;
  const totalPlaySeconds = thinkingSeconds + revealSeconds + introSeconds;
  const wonRun = session.bossesDefeated >= 3;

  /**
   * Pick a deterministic headline variant so copy feels dynamic per run
   * while staying stable across re-renders and tab switches.
   */
  const recapHeadline = (() => {
    const pool = wonRun ? WIN_HEADLINES : LOSS_HEADLINES;
    const seed = Math.abs(
      session.runScore + session.bossesDefeated * 31 + session.answerLog.length * 17,
    );
    return pool[seed % pool.length]!;
  })();

  const formatDuration = (totalSeconds: number) => {
    const safe = Math.max(0, totalSeconds);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleDownload = useCallback(() => {
    void (async () => {
      try {
        /**
         * Rank must not depend on recap prefetch timing: `stats` is often still null if the
         * player hits Download before `/api/game/stats/global` finishes, and that endpoint can
         * fail independently of `/api/game/leaderboard` (which still fills the table).
         */
        let leaderboardRank: number | null = null;
        try {
          const rankRes = await fetch(
            `/api/game/stats/global?score=${encodeURIComponent(String(session.runScore))}`,
            { credentials: "include", cache: "no-store" },
          );
          if (rankRes.ok) {
            const rankData = (await rankRes.json()) as GlobalStats;
            const r = rankData.leaderboardRank;
            leaderboardRank =
              typeof r === "number" && Number.isFinite(r) && r >= 1 ? Math.floor(r) : null;
          }
        } catch {
          /* fall through to cached stats */
        }
        if (leaderboardRank == null) {
          const r = stats?.leaderboardRank;
          leaderboardRank =
            typeof r === "number" && Number.isFinite(r) && r >= 1 ? Math.floor(r) : null;
        }

        await downloadSessionRecapPng({
          displayName: session.displayName,
          twitterHandle: session.twitterHandle,
          avatarUrl: session.avatarUrl,
          walletAddress,
          runScore: session.runScore,
          pythIq: iq,
          bossesDefeated: session.bossesDefeated,
          bossesReached: session.bossesReached,
          correctCount,
          questionsAnswered: session.answerLog.length,
          leaderboardRank,
        });
      } catch {
        /* export uses canvas + optional remote avatar; fail quietly */
      }
    })();
  }, [session, walletAddress, iq, correctCount, stats?.leaderboardRank]);

  const handleShare = useCallback(async () => {
    if (typeof navigator.share !== "function") {
      handleDownload();
      return;
    }
    try {
      await navigator.share({
        title: "Orra Trivia Clash",
        text: buildTriviaShareText(session.runScore, iq, session.bossesDefeated),
      });
    } catch {}
  }, [session.runScore, session.bossesDefeated, iq, handleDownload]);

  const handleShareToX = useCallback(() => {
    const text = buildTriviaShareText(session.runScore, iq, session.bossesDefeated);
    const encodedText = encodeURIComponent(text);
    const url = `https://x.com/intent/post?text=${encodedText}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [session.runScore, session.bossesDefeated, iq]);

  return (
    <div className="w-full max-w-full sm:max-w-4xl mx-auto space-y-6 sm:space-y-8 px-2 sm:px-4 font-manrope">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <h1 className="font-manrope text-[1.45rem] sm:text-3xl font-semibold text-ink-900">
            {recapHeadline}
          </h1>
          <p className="text-sm text-ink-500 font-manrope">
            {wonRun
              ? `${session.bossesDefeated} of 3 guardians defeated`
              : `${session.bossesDefeated} of 3 guardians defeated. One more run for the crown.`}
          </p>
        </div>

        <div className="grid grid-cols-3 sm:flex gap-2 w-full sm:w-auto">
          <ReadingOracleNavCta
            label="Share"
            ariaLabel="Share to X"
            onClick={handleShareToX}
            compact
            className="duel-header-oracle-btn"
            glyph={<FaXTwitter className="oracle-button-svg" size={14} aria-hidden />}
          />
          <ReadingOracleNavCta
            label="Download"
            ariaLabel="Download recap as PNG"
            onClick={handleDownload}
            compact
            className="duel-header-oracle-btn"
            glyph={<MdFileDownload className="oracle-button-svg" size={15} aria-hidden />}
          />
          <ReadingOracleNavCta
            label="Play Again"
            ariaLabel="Play again"
            onClick={onNewSession}
            compact
            className="duel-header-oracle-btn"
            glyph={<MdReplay className="oracle-button-svg" size={15} aria-hidden />}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        {[
          { label: "Score", value: session.runScore, accent: true },
          { label: "Pyth IQ", value: iq, accent: true },
          { label: "Accuracy", value: correctCount, total: session.answerLog.length, accent: false },
          { label: "Time Played", value: totalPlaySeconds, accent: false, isDuration: true },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`card-surface rounded-xl border border-[var(--surface-3)] p-3 sm:p-5 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1 font-manrope">
              {stat.label}
            </div>
            <div className={`text-2xl sm:text-4xl font-bold font-manrope ${stat.accent ? "text-accent-light" : "text-ink-900"}`}>
              {"total" in stat ? (
                <>
                  <AnimatedCounter
                    from={0}
                    to={stat.value as number}
                    duration={0.8}
                    delay={0.2}
                    formatter={(n) => Math.round(n).toString()}
                  />
                  <span className="text-ink-500">/{stat.total}</span>
                </>
              ) : "isDuration" in stat ? (
                formatDuration(stat.value as number)
              ) : (
                <AnimatedCounter
                  from={0}
                  to={stat.value as number}
                  duration={0.8}
                  delay={0.2}
                  formatter={(n) => Math.round(n).toString()}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
        <div className="flex justify-center w-full overflow-x-auto pb-1">
          <div
            className="relative overflow-hidden font-manrope min-w-[min(100%,560px)] w-full"
            role="group"
            aria-label="Recap tabs"
            style={{
              padding: 4,
              borderRadius: 14,
              background: "var(--surface-2)",
              border: "1px solid var(--surface-3)",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                zIndex: 1,
                inset: 4,
                width: `calc(100% / 3 - 4px)`,
                borderRadius: 10,
                background: "var(--surface-3)",
                boxShadow: `
                  0 4px 8px rgba(0, 0, 0, 0.2),
                  inset 0 1px 0 rgba(255, 255, 255, 0.05),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.2)
                `,
                transform: `translateX(${["leaderboard", "questions", "history"].indexOf(activeTab) * 100}%)`,
                transition: "transform 0.55s cubic-bezier(0.22, 0.9, 0.25, 1)",
              }}
            />

            {["leaderboard", "questions", "history"].map((tabName) => {
              const tabLabel =
                tabName === "leaderboard"
                  ? "Leaderboard"
                  : tabName === "questions"
                    ? "Questions"
                    : "History";
              const isActive = activeTab === tabName;
              return (
                <button
                  key={tabName}
                  type="button"
                  onClick={() => setActiveTab(tabName as TabType)}
                  className="relative z-[2] cursor-pointer transition-all duration-300"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px clamp(10px, 2.6vw, 22px)",
                    fontSize: "clamp(12px, 2.8vw, 15px)",
                    fontWeight: 600,
                    letterSpacing: "0.3px",
                    lineHeight: 1,
                    color: isActive ? "var(--ink-900)" : "var(--ink-400)",
                    background: "none",
                    border: "none",
                    whiteSpace: "nowrap",
                  }}
                  aria-selected={isActive}
                  role="tab"
                >
                  {tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "leaderboard" && (
          <div className="animate-in fade-in duration-300">
            <LeaderboardTable leaderboard={leaderboard} loading={loading} />
          </div>
        )}

        {activeTab === "questions" && (
          <div className="animate-in fade-in duration-300">
            <QuestionsContainer
              answerHistory={session.answerHistory}
              correctCount={correctCount}
              totalQuestions={session.answerLog.length}
              loading={loading}
            />
          </div>
        )}

        {activeTab === "history" && (
          <div className="animate-in fade-in duration-300 space-y-3">
            {historyError && (
              <div
                className="card-surface recap-card-static rounded-xl border border-[var(--surface-3)] p-3 sm:p-4 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-manrope"
                role="alert"
              >
                <p className="text-sm text-ink-500">{historyError}</p>
                <button
                  type="button"
                  onClick={() => void loadPastRuns()}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-ink-900"
                  style={{
                    background: "var(--surface-3)",
                    border: "1px solid var(--surface-4)",
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            <RecapHistory pastRuns={pastRuns} loading={historyLoading} />
          </div>
        )}

      </div>


      <style jsx>{`
        @keyframes slideInFromBottom {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

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

        .slide-in-from-bottom-4 {
          animation: slideInFromBottom 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .slide-in-from-left-4 {
          animation: slideInFromLeft 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .duration-300 {
          animation-duration: 0.3s;
        }

        .duration-500 {
          animation-duration: 0.5s;
        }

        .delay-200 {
          animation-delay: 200ms;
        }

        .delay-300 {
          animation-delay: 300ms;
        }

        .fade-in {
          animation: fadeIn 0.3s ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-in,
          .slide-in-from-bottom-4,
          .slide-in-from-left-4,
          .fade-in {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

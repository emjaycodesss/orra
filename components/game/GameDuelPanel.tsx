"use client";

import { useMemo, useRef, useState } from "react";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { Check, X } from "lucide-react";
import { OPPONENTS } from "@/lib/game/opponents";
import { majorArcanaName } from "@/lib/game/tarot-labels";
import type { ClientQuestion, GameSession } from "@/lib/game/types";
import {
  OracleBulletGlyph,
  OracleCrossGlyph,
  OracleReadyGlyph,
  ReadingOracleIconCards,
  ReadingOracleNavCta,
} from "@/components/reading/ReadingWalletHud";

type PublicSession = Omit<GameSession, "currentQuestionAnswer">;

const QUESTION_BUDGET_SEC = 20;

function HpBar({
  label,
  current,
  max,
  variant,
}: {
  label: string;
  current: number;
  max: number;
  variant: "player" | "boss";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const fill =
    variant === "player"
      ? "bg-gradient-to-r from-violet-500 to-fuchsia-400"
      : "bg-gradient-to-r from-rose-500 to-amber-400";
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        <span>{label}</span>
        <span className="tabular text-ink-700">
          {current} / {max}
        </span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full border border-[var(--surface-4)] bg-[var(--surface-3)]"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label} health`}
      >
        <div
          className={`h-full min-w-0 transition-[width] duration-200 ease-out ${fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function GameDuelPanel({
  session,
  busy,
  onAnswerTf,
  onAnswerMcq,
  onPowerUp,
}: {
  session: PublicSession;
  busy: boolean;
  onAnswerTf: (v: boolean) => void;
  onAnswerMcq: (idx: number) => void;
  onPowerUp: (slot: 0 | 1 | 2) => void;
}) {
  const boss = OPPONENTS[session.bossIndex] ?? OPPONENTS[0]!;
  const q = session.currentQuestion;
  const questionId = q?.id ?? null;

  const [remain, setRemain] = useState(QUESTION_BUDGET_SEC);
  const timeoutFiredForQ = useRef<string | null>(null);

  useReactiveEffect(() => {
    timeoutFiredForQ.current = null;
  }, [questionId]);

  useReactiveEffect(() => {
    if (!session.shownAtMs || questionId == null) {
      setRemain(QUESTION_BUDGET_SEC);
      return;
    }
    const shownAt = session.shownAtMs;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - shownAt) / 1000);
      setRemain(Math.max(0, QUESTION_BUDGET_SEC - elapsed));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [session.shownAtMs, questionId]);

  useReactiveEffect(() => {
    if (remain > 0 || !q || busy) return;
    if (timeoutFiredForQ.current === q.id) return;
    timeoutFiredForQ.current = q.id;
    if (q.type === "tf") void onAnswerTf(false);
    else void onAnswerMcq(-1);
  }, [remain, q, busy, onAnswerTf, onAnswerMcq]);

  const logTail = useMemo(
    () => session.answerLog.slice(-12).reverse(),
    [session.answerLog],
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="card-surface card-surface-static space-y-5 rounded-2xl border border-[var(--surface-3)] p-6 shadow-[0_12px_40px_rgba(9,4,18,0.28)] sm:p-7 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              Boss {session.bossIndex + 1} of {OPPONENTS.length}
            </p>
            <h2 className="reading-approach-lede mt-1 font-sans text-xl font-light text-ink-800 sm:text-2xl">
              {boss.name}
            </h2>
            <p className="reading-approach-sub mt-1 max-w-xl font-sans text-[13px] font-medium leading-relaxed text-ink-600">
              {boss.flavor}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">Timer</p>
            <p className="mt-0.5 font-sans text-2xl font-light tabular text-ink-900">{remain}s</p>
          </div>
        </div>

        <HpBar label="You" current={session.playerHp} max={100} variant="player" />
        <HpBar label={boss.name} current={session.oppHp} max={boss.maxHp} variant="boss" />

        {session.suddenDeath && session.awaitingSuddenDeath && (
          <p className="rounded-xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 font-sans text-[13px] font-semibold leading-relaxed text-rose-200">
            Sudden death: one true/false. Wrong answer ends the run.
          </p>
        )}

        {q ? (
          <div className="card-surface space-y-5 rounded-2xl border border-[var(--surface-3)] bg-[var(--surface-2)]/70 p-5 sm:p-6">
            <p className="font-sans text-[15px] font-medium leading-relaxed text-ink-900">{q.stem}</p>
            {q.type === "tf" ? (
              <div className="flex flex-wrap gap-3">
                <ReadingOracleNavCta
                  label="True"
                  ariaLabel="Answer true"
                  onClick={() => onAnswerTf(true)}
                  disabled={busy}
                  compact
                  glyph={<OracleReadyGlyph />}
                  className="reading-nav-oracle-cta--no-pulse min-h-11 min-w-[7.5rem] justify-center disabled:opacity-45"
                />
                <ReadingOracleNavCta
                  label="False"
                  ariaLabel="Answer false"
                  onClick={() => onAnswerTf(false)}
                  disabled={busy}
                  compact
                  glyph={<OracleCrossGlyph />}
                  className="reading-nav-oracle-cta--no-pulse min-h-11 min-w-[7.5rem] justify-center disabled:opacity-45"
                />
              </div>
            ) : (
              <McqOptions q={q} disabled={busy} onPick={onAnswerMcq} />
            )}
          </div>
        ) : (
          <p className="font-sans text-[13px] font-medium text-ink-500">Loading next question…</p>
        )}

        <p className="text-[11px] font-medium tabular text-ink-400">
          Questions this duel: {session.questionsInDuel} (cap {7}) · Score {session.runScore}
        </p>
      </div>

      <div className="space-y-6">
        <div className="card-surface card-surface-static rounded-2xl border border-[var(--surface-3)] p-5 shadow-[0_12px_40px_rgba(9,4,18,0.22)] sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">Powers</p>
          <h3 className="mt-1 font-sans text-[15px] font-medium text-ink-900">Entropy boosters</h3>
          <p className="reading-approach-sub mt-2 font-sans text-[12px] font-medium leading-relaxed text-ink-600">
            Fool: next answer counts correct · Strength: next wrong deals 0 damage · World: next answer
            auto-correct (other majors: −30 score, slot consumed).
          </p>
          <ul className="mt-4 space-y-3">
            {session.boosters.map((b, slot) => (
              <li key={slot}>
                <p className="mb-1 pl-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                  Slot {slot + 1}
                </p>
                <ReadingOracleNavCta
                  label={b.used ? "Used" : majorArcanaName(b.majorIndex)}
                  ariaLabel={`Use booster slot ${slot + 1}`}
                  onClick={() => onPowerUp(slot as 0 | 1 | 2)}
                  disabled={busy || b.used || session.phase !== "running"}
                  glyph={<ReadingOracleIconCards />}
                  className="reading-nav-oracle-cta--no-pulse reading-nav-oracle-cta--block min-h-[3.25rem] disabled:opacity-45"
                />
              </li>
            ))}
          </ul>
        </div>

        <div className="card-surface card-surface-static max-h-64 overflow-y-auto rounded-2xl border border-[var(--surface-3)] p-5 shadow-[0_12px_40px_rgba(9,4,18,0.22)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">Trace</p>
          <h3 className="mt-1 font-sans text-[15px] font-medium text-ink-900">Answer log</h3>
          <ul className="mt-3 space-y-2 text-[12px] text-ink-600">
            {logTail.map((e, i) => (
              <li
                key={`${e.questionId}-${e.latencyMs}-${i}`}
                className="flex items-center gap-2 tabular"
              >
                {e.correct ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0 text-rose-400" aria-hidden />
                )}
                <span>
                  {e.latencyMs}ms · boss {e.bossIndex + 1}
                  {e.scoreKind !== "normal" ? ` · ${e.scoreKind}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function McqOptions({
  q,
  disabled,
  onPick,
}: {
  q: ClientQuestion;
  disabled: boolean;
  onPick: (idx: number) => void;
}) {
  const opts = q.options ?? [];
  return (
    <ul className="space-y-2.5">
      {opts.map((label, idx) => (
        <li key={idx}>
          <ReadingOracleNavCta
            label={label}
            ariaLabel={`Answer: ${label}`}
            onClick={() => onPick(idx)}
            disabled={disabled}
            glyph={<OracleBulletGlyph />}
            className="reading-nav-oracle-cta--no-pulse reading-nav-oracle-cta--block min-h-[3.25rem] disabled:opacity-45"
          />
        </li>
      ))}
    </ul>
  );
}

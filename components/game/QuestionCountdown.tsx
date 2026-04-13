"use client";

import { useRef } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";

interface Props {
  /** Full question budget in seconds (engine + UI share the same value). */
  budgetSec: number;
  /**
   * Server-anchored start time for the visible question (`session.shownAtMs`).
   * Stays null for the first question of each guardian until POST `/api/game/question-clock` after boss-intro.
   * When null/undefined, falls back to mount time so the timer still works if the anchor is missing.
   */
  anchorMs?: number | null;
  onTick: (remain: number) => void;
  onExpire: () => void;
}

/**
 * Self-contained countdown timer.
 * With `anchorMs`, remaining time follows server clock (e.g. Hanged Man revision bumps without remounting).
 * Mount with `key={questionId}` so each new question resets mount-based fallback.
 * Calls onTick every ~250ms and onExpire once per stretch down to 0 (re-arms if the anchor extends time).
 */
export function QuestionCountdown({
  budgetSec,
  anchorMs = null,
  onTick,
  onExpire,
}: Props) {
  const startMs = useRef(Date.now());
  const expiredRef = useRef(false);
  const budgetSecRef = useRef(budgetSec);
  const anchorMsRef = useRef<number | null>(anchorMs ?? null);
  /** Interval is mount-scoped (useMountEffect); refs keep latest parent callbacks (avoid stale q/session on expire). */
  const onTickRef = useRef(onTick);
  const onExpireRef = useRef(onExpire);

  budgetSecRef.current = budgetSec;
  anchorMsRef.current = anchorMs ?? null;
  onTickRef.current = onTick;
  onExpireRef.current = onExpire;

  useMountEffect(() => {
    const tick = () => {
      const anchor = anchorMsRef.current;
      const budget = budgetSecRef.current;
      let remain: number;
      if (anchor != null) {
        remain = Math.max(0, Math.floor(budget - (Date.now() - anchor) / 1000));
      } else {
        const elapsed = Math.floor((Date.now() - startMs.current) / 1000);
        remain = Math.max(0, budget - elapsed);
      }
      if (remain > 0) expiredRef.current = false;
      onTickRef.current(remain);
      if (remain === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };

    const interval = window.setInterval(tick, 250);
    tick();

    return () => window.clearInterval(interval);
  });

  return null;
}

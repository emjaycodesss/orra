"use client";

import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMountEffect } from "@/hooks/useMountEffect";

const DEFAULT_MS = 5500;
const DEFAULT_TARGETS = 6;
const REDUCED_TARGETS = 3;

type DuelComboMinigameProps = {
  /** Parent should only mount this component while the combo is visible (remount = fresh round). */
  reducedMotion: boolean;
  timeLimitMs?: number;
  onClose: () => void;
  /** Invoked after the success burst animation (~400ms). */
  onComplete: () => void;
};

type Pos = { xPct: number; yPct: number; id: string };

function randomPositions(count: number): Pos[] {
  const out: Pos[] = [];
  const minD = 14;
  for (let i = 0; i < count; i++) {
    let xPct = 50;
    let yPct = 50;
    let tries = 0;
    do {
      xPct = 10 + Math.random() * 80;
      yPct = 18 + Math.random() * 72;
      tries++;
    } while (
      tries < 40 &&
      out.some((p) => Math.hypot(p.xPct - xPct, p.yPct - yPct) < minD)
    );
    out.push({ xPct, yPct, id: `t-${i}-${Math.random().toString(36).slice(2, 8)}` });
  }
  return out;
}

function stackedPositions(count: number): Pos[] {
  const step = 70 / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, i) => ({
    xPct: 50,
    yPct: 22 + i * step,
    id: `s-${i}`,
  }));
}

/** Full-screen timed tap targets for landing combo damage. */
export function DuelComboMinigame({
  reducedMotion,
  timeLimitMs = DEFAULT_MS,
  onClose,
  onComplete,
}: DuelComboMinigameProps) {
  const titleId = useId();
  const subtitleId = useId();
  const targetCount = reducedMotion ? REDUCED_TARGETS : DEFAULT_TARGETS;
  const [positions] = useState<Pos[]>(() =>
    reducedMotion ? stackedPositions(targetCount) : randomPositions(targetCount),
  );
  const [hitIds, setHitIds] = useState<Set<string>>(() => new Set());
  /** Mirrors `hitIds` so the hit handler can branch on the next set without effect chains. */
  const hitIdsRef = useRef(hitIds);
  hitIdsRef.current = hitIds;

  const [remainingMs, setRemainingMs] = useState(timeLimitMs);
  const [phase, setPhase] = useState<"play" | "burst">("play");
  const timerRef = useRef<number | null>(null);
  /** Success-path timeout must survive `phase` → burst without being cleared by overlay teardown. */
  const completeTimerRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const bodyOverflowRef = useRef<string>("");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  /** Parent often passes inline `() => setState` — keep timer/escape paths stable. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const startRef = useRef<number>(0);

  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

  /** Timers, global listeners, scroll lock, and focus restore — external systems only (mount/unmount). */
  useMountEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    startRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();

    const tick = () => {
      const t0 = startRef.current;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsed = now - t0;
      const left = Math.max(0, timeLimitMs - elapsed);
      setRemainingMs(left);
      if (left <= 0) {
        if (timerRef.current != null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        onCloseRef.current();
      }
    };
    timerRef.current = window.setInterval(tick, 80);

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onEscape);

    const getFocusable = () => {
      const container = overlayRef.current;
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => !node.hasAttribute("inert"));
    };
    const focusFirst = () => {
      getFocusable()[0]?.focus();
    };
    const onTabKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !active || !overlayRef.current?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (active === last || !active || !overlayRef.current?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node | null;
      if (!overlayRef.current || (target && overlayRef.current.contains(target))) return;
      focusFirst();
    };
    document.addEventListener("keydown", onTabKey);
    document.addEventListener("focusin", onFocusIn);

    const rafId = window.requestAnimationFrame(() => {
      if (cancelButtonRef.current) {
        cancelButtonRef.current.focus();
        return;
      }
      const firstOrb = overlayRef.current?.querySelector<HTMLButtonElement>(".duel-combo-target");
      firstOrb?.focus();
    });

    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (completeTimerRef.current != null) {
        window.clearTimeout(completeTimerRef.current);
        completeTimerRef.current = null;
      }
      window.removeEventListener("keydown", onEscape);
      document.removeEventListener("keydown", onTabKey);
      document.removeEventListener("focusin", onFocusIn);
      window.cancelAnimationFrame(rafId);
      document.body.style.overflow = bodyOverflowRef.current;
      previouslyFocusedRef.current?.focus({ preventScroll: true });
      previouslyFocusedRef.current = null;
    };
  });

  const handleTargetHit = useCallback(
    (id: string) => {
      const prev = hitIdsRef.current;
      if (prev.has(id)) return;
      const next = new Set(prev).add(id);
      hitIdsRef.current = next;
      setHitIds(next);
      const allHitNow = positions.length > 0 && next.size >= positions.length;
      if (!allHitNow) return;
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setPhase("burst");
      completeTimerRef.current = window.setTimeout(() => {
        completeTimerRef.current = null;
        onCompleteRef.current();
      }, 420);
    },
    [positions.length],
  );

  const overlay = (
    <div
      ref={overlayRef}
      className="duel-combo-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={subtitleId}
    >
      <div className="duel-combo-backdrop" aria-hidden />
      <div className="duel-combo-field">
        {positions.map((p) => {
          const done = hitIds.has(p.id);
          if (done) return null;
          return (
            <button
              key={p.id}
              type="button"
              className="duel-combo-target"
              style={{
                left: `${p.xPct}%`,
                top: `${p.yPct}%`,
                transform: "translate(-50%, -50%)",
              }}
              aria-label="Combo target"
              onPointerDown={(e) => {
                e.preventDefault();
                handleTargetHit(p.id);
              }}
              onClick={() => handleTargetHit(p.id)}
            />
          );
        })}
      </div>
      {phase === "burst" && <div className="duel-combo-burst" aria-hidden />}
      <div className="duel-combo-chrome">
        <p id={titleId} className="duel-combo-title">
          COMBO
        </p>
        <p id={subtitleId} className="duel-combo-sub">
          Hit every orb to land combo damage.
        </p>
        <div
          className="duel-combo-timer"
          role="timer"
          aria-live="off"
          aria-label={`Time remaining: ${remainingSeconds} seconds`}
        >
          {(remainingMs / 1000).toFixed(1)}s
        </div>
        <span className="duel-hud-timer-announce" aria-live="polite" aria-atomic="true">
          {remainingSeconds} second{remainingSeconds === 1 ? "" : "s"} remaining
        </span>
        {phase === "play" && (
          <button
            ref={cancelButtonRef}
            type="button"
            className="duel-combo-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

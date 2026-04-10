"use client";

import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type CSSProperties,
} from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import { useReadingAudio } from "@/components/reading/ReadingAudioProvider";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import {
  SPREAD_PHASE_CARD_COUNT as CARD_COUNT,
  SPREAD_DEAL_ANIMATION_MS,
  SPREAD_DEAL_ANIMATION_REDUCED_MS,
  SPREAD_DEAL_STAGGER_MS,
} from "@/lib/reading/spread-phase-constants";

const BACK_SRC = "/cards/back.webp";
const STILLNESS_MS = 1500;
const STILLNESS_REDUCED_MS = 220;
const SETTLE_PAUSE_MS = 900;

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function stable01(seed: number, i: number, salt: number): number {
  const v =
    Math.sin(seed * 0.000891 + i * 12.9898 + salt * 78.233) * 43758.5453123;
  return v - Math.floor(v);
}

function cardTransform(i: number): { rot: number; jx: number; jy: number } {
  const rot = (stable01(42, i, 1) - 0.5) * 14; // ±7deg
  const jx = (stable01(42, i, 2) - 0.5) * 10;  // ±5px
  const jy = (stable01(42, i, 3) - 0.5) * 8;   // ±4px
  return { rot, jx, jy };
}

function restingTransform(i: number): string {
  const { rot, jx, jy } = cardTransform(i);
  return `translate(${jx}px, ${jy}px) rotate(${rot}deg) scale(1)`;
}

/**
 * Map 3 booster arcana indices (0–21) to 3 distinct card slots in the 21-card
 * spread grid. If two boosters land on the same slot (e.g. The Fool=0 and
 * The World=21 both map to slot 0), nudge duplicates to the next free slot.
 */
function boostersToSlots(boosters: [number, number, number]): [number, number, number] {
  const used = new Set<number>();
  return boosters.map((b) => {
    let slot = ((b % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
    while (used.has(slot)) slot = (slot + 1) % CARD_COUNT;
    used.add(slot);
    return slot;
  }) as [number, number, number];
}

interface Props {
  boosters: [number, number, number];
  onComplete: () => void;
  hasBoostersArrived?: boolean;
  onTimeout?: () => void;
}

function SpreadDealAudioScheduler({
  reducedMotion,
  audio,
}: {
  reducedMotion: boolean;
  audio: ReturnType<typeof useReadingAudio>;
}) {
  useMountEffect(() => {
    if (!audio) return;
    audio.primeAudioForSpread();
    const staggerSec = SPREAD_DEAL_STAGGER_MS / 1000;
    const durationSec =
      (reducedMotion ? SPREAD_DEAL_ANIMATION_REDUCED_MS : SPREAD_DEAL_ANIMATION_MS) / 1000;
    const playbackRates = Array.from(
      { length: CARD_COUNT },
      (_, i) => 0.88 + stable01(91, i, 4) * 0.24,
    );
    audio.scheduleSpreadDealShuffleBed({ staggerSec, durationSec, playbackRates });
    return () => {
      audio.cancelSpreadDealSchedule();
    };
  });
  return null;
}

/** Full-screen booster deal + zoom; 30s watchdog calls `onTimeout` if the chain never confirms boosters. */
export function BoosterSpreadPhase({ boosters, onComplete, hasBoostersArrived, onTimeout }: Props) {
  const readingAudio = useReadingAudio();
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  const chosenSlots = useRef<[number, number, number]>(boostersToSlots(boosters));
  chosenSlots.current = boostersToSlots(boosters);

  const [dealt, setDealt] = useState(false);
  const [zooming, setZooming] = useState(false);
  const doneRef = useRef(false);
  const zoomTriggeredRef = useRef(false);
  const pauseTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);
  const zoomTransformsRef = useRef<Record<number, string>>({});
  const stillnessMs = reducedMotion ? STILLNESS_REDUCED_MS : STILLNESS_MS;

  const fireComplete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  }, [onComplete]);

  const startZoom = useCallback(() => {
    if (zoomTriggeredRef.current || doneRef.current) return;

    const slots = chosenSlots.current;
    const headerEl = headerRef.current;

    if (!headerEl) {
      setZooming(true);
      readingAudio?.playRevealCinematic();
      return;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const headerRect = headerEl.getBoundingClientRect();
    const mb = parseFloat(window.getComputedStyle(headerEl).marginBottom || "0");
    const clearBottom = headerRect.bottom + (Number.isFinite(mb) ? mb : 0);
    const belowHeader = Math.max(0, vh - clearBottom);

    const targetH = belowHeader * 0.72;
    const targetW = targetH / 1.6;
    const gap = Math.max(16, vw * 0.022);
    const rawRowW = 3 * targetW + 2 * gap;

    const maxRowW = vw - 48;
    const fit = rawRowW > maxRowW ? maxRowW / rawRowW : 1;
    const finalH = targetH * fit;
    const finalW = targetW * fit;
    const finalGap = gap * fit;
    const finalRowW = 3 * finalW + 2 * finalGap;

    const leftover = belowHeader - finalH;
    const gap2 = leftover * 0.25;
    const rowCY = clearBottom + gap2 + finalH / 2;
    const rowCX = vw / 2;

    const sortedSlots = [...slots].sort((a, b) => a - b);
    const centerXs = [
      rowCX - finalRowW / 2 + finalW / 2,
      rowCX,
      rowCX + finalRowW / 2 - finalW / 2,
    ];

    sortedSlots.forEach((slot, idx) => {
      const el = cardRefs.current[slot];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const scl = finalH / rect.height;
      zoomTransformsRef.current[slot] =
        `translate(${centerXs[idx] - cx}px, ${rowCY - cy}px) rotate(0deg) scale(${scl})`;
    });

    zoomTriggeredRef.current = true;

    if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(
      () => {
        settleTimerRef.current = null;
        setZooming(true);
        readingAudio?.playRevealCinematic();
      },
      reducedMotion ? 0 : SETTLE_PAUSE_MS,
    );
  }, [readingAudio, reducedMotion]);

  useReactiveEffect(() => {
    if (!dealt || !hasBoostersArrived || zoomTriggeredRef.current) return;
    startZoom();
  }, [dealt, hasBoostersArrived, startZoom]);

  useReactiveEffect(() => {
    if (!dealt || hasBoostersArrived || doneRef.current || !onTimeout) return;
    if (watchdogTimerRef.current != null) window.clearTimeout(watchdogTimerRef.current);
    watchdogTimerRef.current = window.setTimeout(() => {
      watchdogTimerRef.current = null;
      if (doneRef.current || hasBoostersArrived) return;
      onTimeout();
    }, 30_000);
    return () => {
      if (watchdogTimerRef.current != null) {
        window.clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    };
  }, [dealt, hasBoostersArrived, onTimeout]);

  const handleLastDealEnd = useCallback(
    (e: AnimationEvent<HTMLDivElement>) => {
      const n = e.animationName || "";
      if (!/reading-spread-deal/i.test(n)) return;
      if (dealt || doneRef.current) return;
      setDealt(true);
      if (hasBoostersArrived && !zoomTriggeredRef.current) {
        startZoom();
      }
    },
    [dealt, hasBoostersArrived, startZoom],
  );

  const handleCardAnimationEnd = useCallback(
    (i: number) => (e: AnimationEvent<HTMLDivElement>) => {
      const n = e.animationName || "";
      if (!/reading-spread-deal/i.test(n)) return;
      if (i !== CARD_COUNT - 1) return;
      handleLastDealEnd(e);
    },
    [handleLastDealEnd],
  );

  const handleTransitionEnd = useCallback(
    (i: number) => (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform") return;
      if (!chosenSlots.current.includes(i) || !zooming || doneRef.current) return;
      if (pauseTimerRef.current != null) return; // already counting
      pauseTimerRef.current = window.setTimeout(() => {
        pauseTimerRef.current = null;
        fireComplete();
      }, stillnessMs);
    },
    [zooming, stillnessMs, fireComplete],
  );

  const caption =
    dealt && hasBoostersArrived
      ? "The chain has chosen your arcana"
      : dealt
        ? "Awaiting the oracle's decree…"
        : "The oracle draws your cards…";

  return (
    <div
      className={`spread-phase${reducedMotion ? " spread-phase--reduced" : ""}`}
      role="presentation"
    >
      <SpreadDealAudioScheduler
        key={reducedMotion ? "spread-audio-reduced" : "spread-audio-default"}
        reducedMotion={reducedMotion}
        audio={readingAudio}
      />
      <div className="spread-phase__header" ref={headerRef}>
        <div className="spread-phase__logo" aria-hidden>
          <ReadingApproachLogoLoader />
        </div>
        <p className="spread-phase__caption font-sans text-center text-[15px] font-light text-ink-700">
          {caption}
        </p>
      </div>
      <div className="spread-phase__table" aria-hidden>
        {Array.from({ length: CARD_COUNT }, (_, i) => {
          const isChosen = chosenSlots.current.includes(i);
          const { rot, jx, jy } = cardTransform(i);

          let inlineStyle: CSSProperties = {
            "--card-rot": `${rot}deg`,
            "--card-jx": `${jx}px`,
            "--card-jy": `${jy}px`,
            "--spread-i": i,
          } as CSSProperties;

          if (dealt) {
            if (zooming && isChosen && zoomTransformsRef.current[i]) {
              inlineStyle = {
                ...inlineStyle,
                animation: "none",
                transform: zoomTransformsRef.current[i],
                zIndex: 40,
              };
            } else if (zooming && !isChosen) {
              inlineStyle = {
                ...inlineStyle,
                animation: "none",
                transform: `${restingTransform(i)} scale(0.92)`,
                opacity: 0,
                pointerEvents: "none" as const,
              };
            } else {
              inlineStyle = {
                ...inlineStyle,
                animation: "none",
                transform: restingTransform(i),
              };
            }
          }

          return (
            <div
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="spread-phase__card"
              style={inlineStyle}
              onAnimationEnd={handleCardAnimationEnd(i)}
              onTransitionEnd={handleTransitionEnd(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BACK_SRC} alt="" className="spread-phase__back" draggable={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

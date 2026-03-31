"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type CSSProperties,
} from "react";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import { useReadingAudio } from "@/components/reading/ReadingAudioProvider";
import {
  SPREAD_PHASE_CARD_COUNT as CARD_COUNT,
  SPREAD_DEAL_ANIMATION_MS,
  SPREAD_DEAL_ANIMATION_REDUCED_MS,
  SPREAD_DEAL_STAGGER_MS,
} from "@/lib/spread-phase-constants";
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
  const rot = (stable01(42, i, 1) - 0.5) * 14;  // ±7deg
  const jx = (stable01(42, i, 2) - 0.5) * 10;   // ±5px
  const jy = (stable01(42, i, 3) - 0.5) * 8;    // ±4px
  return { rot, jx, jy };
}

function restingTransform(i: number): string {
  const { rot, jx, jy } = cardTransform(i);
  return `translate(${jx}px, ${jy}px) rotate(${rot}deg) scale(1)`;
}

interface Props {
  cardIndex: number | null;
  onComplete: () => void;
}

export function SpreadPhase({ cardIndex, onComplete }: Props) {
  const readingAudio = useReadingAudio();
  const readingAudioRef = useRef(readingAudio);
  readingAudioRef.current = readingAudio;
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );

  const [dealt, setDealt] = useState(false);
  const [zooming, setZooming] = useState(false);
  const doneRef = useRef(false);
  const pauseTimerRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const zoomTriggeredRef = useRef(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);
  const zoomTransformRef = useRef<string | null>(null);
  const chosenSlot =
    cardIndex !== null
      ? ((cardIndex % CARD_COUNT) + CARD_COUNT) % CARD_COUNT
      : -1;
  const stillnessMs = reducedMotion ? STILLNESS_REDUCED_MS : STILLNESS_MS;

  const fireComplete = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  }, [onComplete]);

  const startZoom = useCallback((slot: number) => {
    const el = cardRefs.current[slot];
    if (!el) {
      setZooming(true);
      readingAudio?.playRevealCinematic();
      return;
    }

    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const vx = window.innerWidth / 2;

    const headerEl = headerRef.current;
    if (headerEl) {
      const headerRect = headerEl.getBoundingClientRect();
      const marginBottom = parseFloat(
        window.getComputedStyle(headerEl).marginBottom || "0",
      );
      const clearBottom = headerRect.bottom + (Number.isFinite(marginBottom) ? marginBottom : 0);
      const belowHeader = Math.max(0, window.innerHeight - clearBottom);
      const targetH = belowHeader * 0.72;
      const scale = Math.max(0.15, targetH / rect.height);
      const leftover = belowHeader - targetH;
      const gap = leftover * 0.25;
      const targetY = clearBottom + gap + targetH / 2;
      zoomTransformRef.current =
        `translate(${vx - cx}px, ${targetY - cy}px) rotate(0deg) scale(${scale})`;
    } else {
      const vy = window.innerHeight / 2;
      const targetH = window.innerHeight * 0.5;
      const scale = Math.min(targetH / rect.height, 3);
      zoomTransformRef.current =
        `translate(${vx - cx}px, ${vy - cy}px) rotate(0deg) scale(${scale})`;
    }

    setZooming(true);
    readingAudio?.playRevealCinematic();
  }, [readingAudio]);

  const tryStartZoom = useCallback(() => {
    if (zoomTriggeredRef.current || zooming || doneRef.current) return;
    if (cardIndex === null) return;
    const slot = ((cardIndex % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
    zoomTriggeredRef.current = true;

    if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(
      () => {
        settleTimerRef.current = null;
        startZoom(slot);
      },
      reducedMotion ? 100 : SETTLE_PAUSE_MS,
    );
  }, [cardIndex, zooming, reducedMotion, startZoom]);

  if (dealt && cardIndex !== null && !zoomTriggeredRef.current && !zooming && !doneRef.current) {
    tryStartZoom();
  }

  const handleLastDealEnd = useCallback(
    (e: AnimationEvent<HTMLDivElement>) => {
      const n = e.animationName || "";
      if (!/reading-spread-deal/i.test(n)) return;
      if (dealt || doneRef.current) return;
      setDealt(true);
      if (cardIndex !== null) {
        tryStartZoom();
      }
    },
    [dealt, cardIndex, tryStartZoom],
  );

  const handleLastDealEndReduced = useCallback(
    (e: AnimationEvent<HTMLDivElement>) => {
      if (!reducedMotion) return;
      const n = e.animationName || "";
      if (!/reading-spread-deal/i.test(n)) return;
      if (doneRef.current) return;
      setDealt(true);
      if (cardIndex !== null) {
        const slot = ((cardIndex % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
        zoomTriggeredRef.current = true;
        startZoom(slot);
        if (pauseTimerRef.current != null) window.clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = window.setTimeout(() => {
          pauseTimerRef.current = null;
          fireComplete();
        }, stillnessMs);
      }
    },
    [reducedMotion, cardIndex, stillnessMs, fireComplete, startZoom],
  );

  const handleTransitionEnd = useCallback(
    (i: number) => (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform") return;
      if (i !== chosenSlot || !zooming || doneRef.current) return;
      if (pauseTimerRef.current != null) window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = window.setTimeout(() => {
        pauseTimerRef.current = null;
        fireComplete();
      }, stillnessMs);
    },
    [chosenSlot, zooming, stillnessMs, fireComplete],
  );

  // One shuffle-bed hit per card on the Web Audio timeline: matches CSS stagger + deal duration.
  useEffect(() => {
    const audio = readingAudioRef.current;
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
      readingAudioRef.current?.cancelSpreadDealSchedule();
    };
  }, [reducedMotion]);

  const handleCardAnimationEnd = useCallback(
    (i: number) => (e: AnimationEvent<HTMLDivElement>) => {
      const n = e.animationName || "";
      if (!/reading-spread-deal/i.test(n)) return;
      if (i !== CARD_COUNT - 1) return;
      if (reducedMotion) handleLastDealEndReduced(e);
      else handleLastDealEnd(e);
    },
    [reducedMotion, handleLastDealEndReduced, handleLastDealEnd],
  );

  const caption =
    dealt && cardIndex !== null
      ? "The chain has chosen your arcana"
      : "The oracle draws your card…";

  return (
    <div
      className={`spread-phase ${reducedMotion ? "spread-phase--reduced" : ""}`}
      role="presentation"
    >
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
          const isChosen = i === chosenSlot;
          const { rot, jx, jy } = cardTransform(i);

          let inlineStyle: CSSProperties = {
            "--card-rot": `${rot}deg`,
            "--card-jx": `${jx}px`,
            "--card-jy": `${jy}px`,
            "--spread-i": i,
          } as CSSProperties;

          if (dealt) {
            if (zooming && isChosen && zoomTransformRef.current) {
              inlineStyle = {
                ...inlineStyle,
                animation: "none",
                transform: zoomTransformRef.current,
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
              ref={(el) => { cardRefs.current[i] = el; }}
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

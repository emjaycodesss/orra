"use client";

import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type TransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import { MAJOR_ARCANA, type CardOrientation } from "@/lib/cards";
type InspectSlot = { left: number; top: number; width: number; height: number };

interface Props {
  cardIndex: number;
  orientation: CardOrientation;
}

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

const BACK_SRC = "/cards/back.webp";

function pointerTiltDegs(px: number, py: number) {
  const centerX = px - 50;
  const centerY = py - 50;
  return {
    rotX: centerY / 3.5,
    rotY: -centerX / 3.5,
  };
}

export function HolographicCard({ cardIndex, orientation }: Props) {
  const card = MAJOR_ARCANA[cardIndex];
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false
  );
  const [flipDone, setFlipDone] = useState(false);
  const [popover, setPopover] = useState<{
    dx: number;
    dy: number;
    scale: number;
  } | null>(null);
  const [inspectExpanded, setInspectExpanded] = useState(false);
  const [inspectSpin, setInspectSpin] = useState(false);
  const [inspectSlot, setInspectSlot] = useState<InspectSlot | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const translaterRef = useRef<HTMLDivElement | null>(null);
  const motionLockRef = useRef(false);
  const inspectActiveRef = useRef(false);
  const firstPopRef = useRef(true);
  const isReversed = orientation === "reversed";

  const inspectActive = popover !== null;

  const attachTranslaterRef = useCallback(
    (node: HTMLDivElement | null) => {
      translaterRef.current = node;
      if (node && popover !== null && inspectSlot) {
        node.focus({ preventScroll: true });
      }
    },
    [popover, inspectSlot]
  );

  const applyNeutralPointer = useCallback(() => {
    const el = sceneRef.current;
    if (!el) return;
    el.style.setProperty("--pointer-x", "50%");
    el.style.setProperty("--pointer-y", "50%");
    el.style.setProperty("--pointer-from-left", "0.5");
    el.style.setProperty("--pointer-from-top", "0.5");
    el.style.setProperty("--pointer-from-center", "0");
    el.style.setProperty("--rot-x", "0deg");
    el.style.setProperty("--rot-y", "0deg");
    el.style.setProperty("--hyp", "0");
  }, []);

  const computePopover = useCallback(() => {
    const el = translaterRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scaleW = (vw * 0.9) / rect.width;
    const scaleH = (vh * 0.88) / rect.height;
    const scale = Math.min(scaleW, scaleH, 1.75);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return {
      dx: vw / 2 - cx,
      dy: vh / 2 - cy,
      scale,
    };
  }, []);

  const openInspect = useCallback(() => {
    const el = translaterRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setInspectSlot({ left: r.left, top: r.top, width: r.width, height: r.height });
    }
    if (reducedMotion) {
      inspectActiveRef.current = true;
      setInspectExpanded(true);
      setPopover({ dx: 0, dy: 0, scale: 1.04 });
      return;
    }
    const next = computePopover();
    if (!next) {
      setInspectSlot(null);
      return;
    }
    inspectActiveRef.current = true;
    setInspectExpanded(true);
    setPopover(next);
    motionLockRef.current = true;
    if (firstPopRef.current) {
      firstPopRef.current = false;
      setInspectSpin(true);
    }
  }, [computePopover, reducedMotion]);

  const closeInspect = useCallback(() => {
    inspectActiveRef.current = false;
    setInspectExpanded(false);
    if (reducedMotion) {
      motionLockRef.current = false;
      setPopover(null);
      setInspectSlot(null);
      return;
    }
    setPopover({ dx: 0, dy: 0, scale: 1 });
    motionLockRef.current = true;
  }, [reducedMotion]);

  const toggleInspect = useCallback(() => {
    if (!flipDone || motionLockRef.current) return;
    if (inspectActiveRef.current) {
      closeInspect();
    } else {
      openInspect();
    }
  }, [flipDone, closeInspect, openInspect]);

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!flipDone || reducedMotion) return;
      const el = sceneRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = Math.max(rect.width, 1);
      const h = Math.max(rect.height, 1);
      const px = ((e.clientX - rect.left) / w) * 100;
      const py = ((e.clientY - rect.top) / h) * 100;
      const { rotX, rotY } = pointerTiltDegs(px, py);
      const nx = (px - 50) / 50;
      const ny = (py - 50) / 50;
      const hyp = Math.min(1, Math.hypot(nx, ny));
      el.style.setProperty("--pointer-x", `${px}%`);
      el.style.setProperty("--pointer-y", `${py}%`);
      el.style.setProperty("--pointer-from-left", (px / 100).toFixed(4));
      el.style.setProperty("--pointer-from-top", (py / 100).toFixed(4));
      el.style.setProperty("--pointer-from-center", hyp.toFixed(3));
      el.style.setProperty("--rot-x", `${rotX.toFixed(2)}deg`);
      el.style.setProperty("--rot-y", `${rotY.toFixed(2)}deg`);
      el.style.setProperty("--hyp", hyp.toFixed(3));
    },
    [flipDone, reducedMotion]
  );

  const handlePointerLeave = useCallback(() => {
    applyNeutralPointer();
  }, [applyNeutralPointer]);

  const handleFlipEnd = useCallback(
    (e: AnimationEvent<HTMLDivElement>) => {
      const n = e.animationName || "";
      if (!/reading-holo-flip-y/.test(n)) return;
      setFlipDone(true);
      applyNeutralPointer();
    },
    [applyNeutralPointer]
  );

  const handlePopoverTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "transform") return;
      motionLockRef.current = false;
      if (!inspectActiveRef.current) {
        setPopover(null);
        setInspectSlot(null);
      }
    },
    []
  );

  const handleInspectSpinEnd = useCallback((e: AnimationEvent<HTMLDivElement>) => {
    if (e.animationName !== "reading-holo-inspect-spin") return;
    setInspectSpin(false);
  }, []);

  const handleCardActivate = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      if (!flipDone) return;
      toggleInspect();
    },
    [flipDone, toggleInspect]
  );

  const handleCardKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!flipDone) return;
      if (e.key === "Escape" && inspectActiveRef.current) {
        e.preventDefault();
        closeInspect();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleInspect();
      }
    },
    [flipDone, closeInspect, toggleInspect]
  );

  if (!card) return null;

  const popoverStyle =
    popover === null
      ? undefined
      : {
          transform: `translate3d(${popover.dx}px, ${popover.dy}px, 0) scale(${popover.scale})`,
        };

  const portaledInspect = popover !== null && inspectSlot !== null;

  const translaterStyle: CSSProperties = {
    touchAction: "none",
    ...popoverStyle,
    ...(portaledInspect
      ? {
          position: "fixed",
          left: inspectSlot.left,
          top: inspectSlot.top,
          width: inspectSlot.width,
          height: inspectSlot.height,
          zIndex: 260,
          margin: 0,
          boxSizing: "border-box",
        }
      : {}),
    transition:
      flipDone && !reducedMotion && popover !== null
        ? "transform 0.78s cubic-bezier(0.2, 0.82, 0.22, 1)"
        : undefined,
  };

  const translater = (
    <div
      ref={attachTranslaterRef}
      className={`reading-holo-translater ${flipDone ? "reading-holo-translater--interactive" : ""} ${inspectActive ? "reading-holo-translater--active" : ""}`}
      role="button"
      tabIndex={flipDone ? 0 : -1}
      aria-pressed={inspectExpanded}
      aria-label={
        inspectExpanded
          ? "Card enlarged — press to return"
          : "Inspect card — press to enlarge and spin"
      }
      onClick={handleCardActivate}
      onKeyDown={handleCardKeyDown}
      onTransitionEnd={handlePopoverTransitionEnd}
      style={translaterStyle}
    >
      <div
        className={`reading-holo-inspect-spin-shell ${inspectSpin && !reducedMotion ? "reading-holo-inspect-spin-host" : ""}`}
        onAnimationEnd={handleInspectSpinEnd}
      >
        <div
          ref={sceneRef}
          className={`reading-holo-scene ${reducedMotion ? "reading-holo-scene--reduced" : ""} ${flipDone ? "reading-holo-scene--interactive" : ""}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          <div
            className="reading-holo-flipper"
            onAnimationEnd={handleFlipEnd}
          >
            <div className="reading-holo-face reading-holo-face--back">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BACK_SRC} alt="" className="reading-holo-img" draggable={false} />
            </div>
            <div className="reading-holo-face reading-holo-face--front">
              <div className="reading-holo-tilt">
                <div
                  className={`reading-holo-art ${isReversed ? "reading-holo-art--reversed" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.image}
                    alt=""
                    className="reading-holo-img"
                    draggable={false}
                  />
                </div>
                <div className="reading-holo-shine" aria-hidden />
                <div className="reading-holo-glare" aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="reading-holo-root-entrance flex flex-col items-center gap-6">
      <p className="sr-only">
        {card.name}
        {isReversed ? ", reversed" : ", upright"}
      </p>
      {popover === null ? (
        translater
      ) : inspectSlot ? (
        <>
          <div
            className="pointer-events-none mx-auto shrink-0"
            style={{ width: inspectSlot.width, height: inspectSlot.height }}
            aria-hidden
          />
          {typeof document !== "undefined" &&
            createPortal(
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[250] cursor-default border-0 bg-[#12091d]/75 p-0 backdrop-blur-[2px]"
                  aria-label="Close enlarged card"
                  onClick={() => {
                    if (!motionLockRef.current) closeInspect();
                  }}
                />
                {translater}
              </>,
              document.body
            )}
        </>
      ) : (
        translater
      )}
    </div>
  );
}

"use client";

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createOrbitCanvas, type OrbitAnimState } from "@/lib/orbit-canvas";

// Module-level flags so Strict Mode / remount doesn’t reset post-portal orbit physics.
const readingOrbitAnim: OrbitAnimState = { collapse: false, expanse: false };

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface ReadingOrbitLayerProps {
  showEnterOverlay: boolean;
  onPortalEntered: () => void;
  softenForContent?: boolean;
  onEnterClick?: () => void;
}

export function ReadingOrbitLayer({
  showEnterOverlay,
  onPortalEntered,
  softenForContent = false,
  onEnterClick,
}: ReadingOrbitLayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Reset physics only when intro (re)activates, not on unrelated layout (preserves ENTER hover).
  const wasIntroPortalRef = useRef(false);
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  // One canvas per mount — don’t recreate on phase/prop churn.
  useLayoutEffect(() => {
    if (reducedMotion) return;
    const node = hostRef.current;
    if (!node) return;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "absolute inset-0 h-full w-full";
    node.appendChild(canvas);

    const cleanup = createOrbitCanvas(canvas, node, () => readingOrbitAnim);

    return () => {
      cleanup();
    };
  }, [reducedMotion]);

  // Re-arm pre-portal physics only when ENTER appears again, not while it stays open.
  useLayoutEffect(() => {
    if (reducedMotion) return;
    const introPortal = showEnterOverlay && !overlayDismissed;
    if (introPortal && !wasIntroPortalRef.current) {
      readingOrbitAnim.collapse = false;
      readingOrbitAnim.expanse = false;
    }
    wasIntroPortalRef.current = introPortal;
  }, [showEnterOverlay, overlayDismissed, reducedMotion]);

  const handleEnterHoverChange = useCallback(
    (hovering: boolean) => {
      if (reducedMotion) return;
      if (!showEnterOverlay || overlayDismissed) return;
      readingOrbitAnim.collapse = hovering;
    },
    [reducedMotion, showEnterOverlay, overlayDismissed],
  );

  const handleEnter = useCallback(() => {
    onEnterClick?.();
    if (!reducedMotion) {
      readingOrbitAnim.collapse = true;
      readingOrbitAnim.expanse = true;
    }
    setOverlayDismissed(true);
    window.setTimeout(
      () => onPortalEntered(),
      reducedMotion ? 0 : 850,
    );
  }, [onEnterClick, onPortalEntered, reducedMotion]);

  return (
    <div
      className={`reading-orbit-layer pointer-events-none fixed inset-0 z-0 transition-opacity duration-700 ease-out ${
        softenForContent ? "opacity-[0.72]" : "opacity-100"
      }`}
    >
      {reducedMotion ? (
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 45%, rgba(120, 80, 180, 0.16) 0%, #12091d 55%)",
          }}
        />
      ) : (
        <div ref={hostRef} className="reading-orbit-layer__canvas-host absolute inset-0" aria-hidden />
      )}
      {showEnterOverlay && !overlayDismissed && (
        <div className="reading-orbit-layer__enter-wrap pointer-events-auto fixed inset-0 z-[1] flex items-center justify-center">
          <button
            type="button"
            className="reading-orbit-enter-btn group rounded-sm border-0 bg-transparent px-6 py-4 transition-transform duration-500 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-light/50"
            onClick={handleEnter}
            onMouseEnter={() => handleEnterHoverChange(true)}
            onMouseLeave={() => handleEnterHoverChange(false)}
            onFocus={() => handleEnterHoverChange(true)}
            onBlur={() => handleEnterHoverChange(false)}
          >
            <span className="reading-orbit-enter-label font-sans text-[clamp(15px,4vw,18px)] tracking-[0.2em] text-ink-500 transition-colors duration-500 drop-shadow-[0_0_20px_rgba(167,139,250,0.45)]">
              ENTER
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

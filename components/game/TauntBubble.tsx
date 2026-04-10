"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import "./TauntBubble.css";

interface Props {
  text: string | null;
  side: "player" | "boss";
  variant?: "answer" | "powerup";
}

/**
 * Minimal 3D taunt bubble with glassmorphism.
 * Layout: player lines up upper-left of the arena avatar; boss upper-right (see TauntBubble.css).
 * Player: purple. Boss: yellow. Auto-dismisses after 3s.
 */
export function TauntBubble({ text, side, variant = "answer" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useReactiveEffect(() => {
    const el = ref.current;
    if (!el || !text) return;

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      gsap.set(el, { opacity: 1, visibility: "visible" });
      const t = window.setTimeout(() => gsap.set(el, { opacity: 0, visibility: "hidden" }), 3000);
      return () => window.clearTimeout(t);
    }

    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.75, rotateX: -15, rotateZ: -2, visibility: "visible" },
      { opacity: 1, scale: 1, rotateX: 0, rotateZ: 0, duration: 0.35, ease: "back.out(1.5)" },
    );

    const timer = window.setTimeout(() => {
      gsap.to(el, {
        opacity: 0,
        scale: 0.85,
        rotateX: 12,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          gsap.set(el, { visibility: "hidden" });
        },
      });
    }, 3000);

    return () => {
      window.clearTimeout(timer);
      gsap.killTweensOf(el);
    };
  }, [text]);

  if (!text) return null;

  return (
    <div
      ref={ref}
      className={`taunt-bubble taunt-bubble--${side}`}
      style={{ visibility: "hidden" }}
      aria-live="polite"
      aria-atomic="true"
    >
      {text}
    </div>
  );
}

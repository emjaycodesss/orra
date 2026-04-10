"use client";

import { useMountEffect } from "@/hooks/useMountEffect";

interface Props {
  delayMs?: number;
  onComplete: () => void;
}

/**
 * Silent timer that calls onComplete after delayMs (default 3000).
 * Mount with key={questionId} to get a fresh timer per question.
 * Renders nothing — purely behavioral.
 */
export function RevealAdvanceTimer({ delayMs = 3000, onComplete }: Props) {
  useMountEffect(() => {
    const t = window.setTimeout(onComplete, delayMs);
    return () => window.clearTimeout(t);
  });

  return null;
}

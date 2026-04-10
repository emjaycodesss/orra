"use client";

import { OPPONENTS } from "@/lib/game/opponents";

interface Props {
  bossIndex: number;
  active: boolean;
}

/** Full-screen background scene per boss. CSS-only animations, no JS. */
export function DuelArenaBackground({ bossIndex, active }: Props) {
  const scene = OPPONENTS[bossIndex]?.scene ?? "arena-scene--planck";
  if (!active) return null;
  return (
    <div
      className={`fixed inset-0 -z-10 transition-opacity duration-500 ${scene}`}
      aria-hidden
    />
  );
}

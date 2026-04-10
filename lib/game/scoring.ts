import type { AnswerLogEntry } from "./types";

export function pointsForAnswer(
  bossIndex: number,
  kind: AnswerLogEntry["scoreKind"],
  correct: boolean,
): number {
  const b = bossIndex + 1;
  if (kind === "fool") return 0;
  /** Wheel “free skip” branch — auto-correct with no points (matches Fool spirit). */
  if (kind === "wheel-auto") return 0;
  if (kind === "world" && correct) return Math.floor(50 * b);
  if (correct) return 100 * b;
  return -40;
}

export function bossClearBonus(): number {
  return 250;
}

export function hpEndOfDuelBonus(playerHp: number): number {
  return 2 * Math.max(0, playerHp);
}

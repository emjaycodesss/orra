import type { AnswerLogEntry } from "./types";

export function pointsForAnswer(
  bossIndex: number,
  kind: AnswerLogEntry["scoreKind"],
  correct: boolean,
): number {
  const b = bossIndex + 1;
  if (kind === "fool") return 0;
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

export function powerUpPenalty(): number {
  return 30;
}

export function totalScoreFromLog(
  entries: AnswerLogEntry[],
  bossesDefeated: number,
  hpBonuses: number[],
  powerUpsUsed: number,
): number {
  let s = 0;
  for (const e of entries) {
    s += pointsForAnswer(e.bossIndex, e.scoreKind, e.correct);
  }
  s += bossesDefeated * bossClearBonus();
  for (const h of hpBonuses) s += hpEndOfDuelBonus(h);
  s -= powerUpsUsed * powerUpPenalty();
  return Math.max(0, s);
}

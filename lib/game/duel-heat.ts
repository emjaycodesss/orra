import type { AnswerLogEntry, GameSession } from "./types";

/** Combo becomes available when duelHeat reaches this value (server-authoritative). */
export const DUEL_HEAT_MAX = 100;

/** Heat per graded correct answer that deals boss HP damage (normal path). */
export const DUEL_HEAT_PER_CORRECT = 20;

/**
 * Heat for Fool / Wheel free-skip corrects (0 boss chip damage) — lower so the gauge
 * cannot fill in two ticks from "free" answers alone.
 */
export const DUEL_HEAT_ZERO_BOSS_DAMAGE_CORRECT = 8;

/**
 * Duel is still contested — heat can accumulate and combo may be available.
 */
export function isDuelHeatActive(s: GameSession): boolean {
  return s.phase === "running" && s.playerHp > 0 && s.oppHp > 0;
}

/**
 * After a graded answer, add heat for correct plays only (wrong adds 0).
 */
export function addDuelHeatAfterAnswer(
  s: GameSession,
  params: { correct: boolean; scoreKind: AnswerLogEntry["scoreKind"] },
): GameSession {
  if (!isDuelHeatActive(s)) return s;
  if (!params.correct) return s;
  const kind = params.scoreKind;
  const delta =
    kind === "fool" || kind === "wheel-auto"
      ? DUEL_HEAT_ZERO_BOSS_DAMAGE_CORRECT
      : DUEL_HEAT_PER_CORRECT;
  const prev = s.duelHeat ?? 0;
  const duelHeat = Math.min(DUEL_HEAT_MAX, prev + delta);
  return { ...s, duelHeat };
}

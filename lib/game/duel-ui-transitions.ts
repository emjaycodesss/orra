import { OPPONENTS } from "@/lib/game/opponents";

/**
 * Input used to derive boss intro copy for duel UI transitions.
 * Only `bossIndex` is required because intro copy is index-driven.
 */
type BossIntroMetaInput = {
  bossIndex: number;
};

/**
 * Input used to detect whether an answer advanced to the next boss.
 */
type BossDefeatTransitionInput = {
  previousBossIndex: number;
  currentBossIndex: number;
  answerBossIndex: number;
};

/**
 * Input used to detect boss defeats between two server snapshots.
 * `bossesDefeated` increments even on the final guardian where boss index does not advance.
 */
type BossDefeatSnapshotsInput = {
  previousBossIndex: number;
  previousBossesDefeated: number;
  currentBossIndex: number;
  currentBossesDefeated: number;
};

/**
 * Builds boss intro title/subtitle from the current boss index.
 * Uses canonical opponent display names so intro copy stays in sync with guardian data.
 */
export function getBossIntroMeta(input: BossIntroMetaInput): {
  title: string;
  subtitle: string;
} {
  const bossNumber = input.bossIndex + 1;
  const bossName = OPPONENTS[input.bossIndex]?.displayName ?? `Boss ${bossNumber}`;

  return {
    title: `Guardian ${bossNumber}: ${bossName}`,
    subtitle: `Here comes ${bossName}. Hold your line.`,
  };
}

/**
 * Returns true when the session boss index moved forward and
 * the answer was evaluated against the prior boss.
 */
export function isBossDefeatTransition(
  input: BossDefeatTransitionInput,
): boolean {
  return (
    input.currentBossIndex > input.previousBossIndex &&
    input.answerBossIndex === input.previousBossIndex
  );
}

/**
 * Returns true when a boss was defeated between two snapshots.
 * This handles both mid-run transitions (boss index advances) and final KO
 * where only `bossesDefeated` increases before phase becomes ended.
 * Regressive/out-of-order snapshots return false — defeats require monotonic progress.
 */
export function didBossDefeatBetweenSnapshots(
  input: BossDefeatSnapshotsInput,
): boolean {
  if (
    input.currentBossIndex < input.previousBossIndex ||
    input.currentBossesDefeated < input.previousBossesDefeated
  ) {
    return false;
  }

  return (
    input.currentBossIndex > input.previousBossIndex ||
    input.currentBossesDefeated > input.previousBossesDefeated
  );
}

/**
 * Whether the post-answer reveal should run the guardian-defeat branch (defeat taunts, frozen 0 HP,
 * then `ko-pending` + arena KO when `comboPendingKo` is set).
 *
 * Mid-run lethal: `nextSession.bossIndex` advances. Final guardian lethal: index stays on Chop (2) but
 * `nextSession.phase` is `"ended"` — without this, `pendingBossIntroRef` never latches and the arena
 * K.O. sequence never runs while `duelPhase` is stuck in `advancing`.
 */
export function shouldRevealArenaBossDefeatAfterAnswer(input: {
  bossChangedFromPrev: boolean;
  lastEntryBossIndex: number;
  sessionBossIndex: number;
  comboPendingKo: { nextSession: { bossIndex: number; phase: string } } | null;
}): boolean {
  const midRunBufferedNextGuardian =
    input.comboPendingKo != null &&
    input.comboPendingKo.nextSession.bossIndex !== input.sessionBossIndex;
  const runVictoryBuffered =
    input.comboPendingKo != null && input.comboPendingKo.nextSession.phase === "ended";
  return (
    input.bossChangedFromPrev ||
    input.lastEntryBossIndex !== input.sessionBossIndex ||
    midRunBufferedNextGuardian ||
    runVictoryBuffered
  );
}

/**
 * Builds the combo damage API payload shape expected by the duel route.
 * This intentionally stays as a thin wrapper to keep call sites explicit
 * while centralizing payload shape if the route contract evolves.
 */
export function buildComboDamagePayload(
  comboDamageHp: number,
): { comboDamageHp: number } {
  return { comboDamageHp };
}

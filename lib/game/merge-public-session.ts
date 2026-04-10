import type { GameSession } from "./types";

export type PublicGameSession = Omit<GameSession, "currentQuestionAnswer">;

/**
 * Merges a server snapshot into local React state. When the cookie points at a new file session
 * (e.g. after POST /api/game/exit), `id` changes and revision resets — revision-only comparison would
 * incorrectly keep a stale duel snapshot.
 */
export function mergePublicSessionFromServer(
  prev: PublicGameSession | null,
  incoming: PublicGameSession,
): PublicGameSession {
  if (!prev || prev.id !== incoming.id) {
    return incoming;
  }
  const prevRev = prev.revision ?? 0;
  const incomingRev = incoming.revision ?? 0;
  return incomingRev >= prevRev ? incoming : prev;
}

/**
 * Answer route returned the real post-defeat snapshot while arena KO is still buffered. Merge
 * grading/reveal fields from `incoming` but keep the pre-defeat guardian frame (boss slot, HP,
 * shield, on-screen question) from `latest` so `GameDuelPanel` can enter `revealing` from
 * `answerLog` growth without swapping the arena early. Full `incoming` remains on
 * `comboPendingKo.nextSession` for `onComboKoComplete`.
 *
 * Final-guardian lethal is different: the engine sets `phase` to `"ended"` and
 * `bossesDefeated` increments with no boss-index advance. If we pasted the mid-duel merge here,
 * we'd keep stale HP/`bossesDefeated` while `phase` stayed `"ended"`, which unmounts the arena and
 * skips the KO overlay. Treat run victory as "still running" in React until `onComboKoComplete`.
 */
export function mergePublicSessionForAnswerBossDefeatReveal(
  latest: PublicGameSession,
  incoming: PublicGameSession,
): PublicGameSession {
  const runVictoryWhileBufferingKo =
    incoming.phase === "ended" && incoming.bossesDefeated > latest.bossesDefeated;

  if (runVictoryWhileBufferingKo) {
    return {
      ...incoming,
      phase: "running",
      bossIndex: latest.bossIndex,
      currentQuestion: latest.currentQuestion,
      shownAtMs: latest.shownAtMs,
    };
  }

  return {
    ...incoming,
    bossIndex: latest.bossIndex,
    playerHp: latest.playerHp,
    oppHp: latest.oppHp,
    chopShieldHp: latest.chopShieldHp,
    bossesDefeated: latest.bossesDefeated,
    currentQuestion: latest.currentQuestion,
    shownAtMs: latest.shownAtMs,
    duelHeat: latest.duelHeat,
  };
}

import type { GameSession } from "@/lib/game/types";

export type ComboPublicSession = Omit<GameSession, "currentQuestionAnswer">;

/**
 * Buffered combo API result: arena KO plays while `session` still shows the defeated guardian;
 * parent applies `nextSession` only after `onComboKoComplete(nextSession)`.
 */
export type ComboPendingKo = {
  displayName: string;
  nextSession: ComboPublicSession;
  /** Incoming server snapshot deltas (pre-merge) for KO overlay chips / recap feedback. */
  feedback?: {
    bossHpDelta: number;
    playerHpDelta: number;
    scoreDelta: number;
  };
};

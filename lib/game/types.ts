export type QuestionType = "tf" | "mcq";

export interface BankQuestion {
  id: string;
  type: QuestionType;
  stem: string;
  topic: string;
  /** Legacy: tier-based routing. Use bossIndex when available. */
  tiers?: number[];
  /** Boss-specific routing (preferred over tiers). */
  bossIndex?: 0 | 1 | 2;
  difficulty?: 1 | 2 | 3;
  answerBool?: boolean;
  options?: string[];
  correctIndex?: number;
}

export interface ClientQuestion {
  id: string;
  type: QuestionType;
  stem: string;
  options?: string[];
  /** High Priestess: index of the eliminated wrong MCQ option */
  eliminatedIndex?: number;
  /** Sun: reveals correct option index to client (MCQ) */
  sunCorrectIndex?: number;
  /** Sun: reveals correct True/False to client (TF) */
  sunCorrectBool?: boolean;
  /** High Priestess (TF): oracle leans toward true/false */
  tfLean?: "true" | "false";
  /** Hierophant: copy describing the armed +5 bonus (not a quiz spoiler) */
  hierophantHint?: string;
}

export interface AnswerLogEntry {
  questionId: string;
  correct: boolean;
  bossIndex: number;
  latencyMs: number;
  scoreKind: "normal" | "fool" | "world" | "wheel-auto";
}

export interface AnswerHistoryEntry {
  questionId: string;
  questionType: QuestionType;
  stem: string;
  correct: boolean;
  correctLabel: string;
  pickedLabel: string;
}

/** Hermes comparison window key (mirrors pyth-hermes-snapshot; avoids importing snapshot into types). */
export type OracleComparisonWindowKey = "1h" | "1d" | "1w" | "1m";

/** Wheel of Fortune: which branch fired (shown to client until next answer). */
export type LastWheelOutcome =
  | "wheel_heal10"
  | "wheel_hurt10"
  | "wheel_free_skip"
  | "wheel_double_next";

export interface PreparedGameQuestion {
  id: string;
  bossIndex: 0 | 1 | 2;
  type: QuestionType;
  stem: string;
  options?: string[];
  correctIndex?: number;
  answerBool?: boolean;
  sourceMode: "seed" | "live";
  /** template-* / bank are deterministic; ai / seed-facts-fallback from LLM paths */
  source: "ai" | "seed-facts-fallback" | "template-seed" | "template-live" | "bank";
  /** Carried from bank rows for topicMissCounts when id matches bank.json. */
  topic?: string;
  /** Live oracle row used to author this question (debug / future UI). */
  oracleProvenance?: {
    quizSymbol: string;
    returnOverWindowPct: number;
    effectiveComparisonWindow: OracleComparisonWindowKey;
    publishTime: number;
  };
}

export interface GameSession {
  id: string;
  createdAt: number;
  /** Monotonic revision for optimistic concurrency on writes. */
  revision: number;
  walletAddress: string | null;
  twitterHandle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  phase: "lobby" | "running" | "ended";
  bossIndex: number;
  questionsInDuel: number;
  playerHp: number;
  oppHp: number;
  /** Chop's regenerating shield HP (max 50) */
  chopShieldHp: number;
  /** Player combo heat gauge for the current guardian segment (0..100). Resets on duel advance. */
  duelHeat: number;
  suddenDeath: boolean;
  /** One TF after 7-question cap when HP was tied */
  awaitingSuddenDeath: boolean;
  judgementUsed: boolean;
  boosters: { majorIndex: number; used: boolean; locked?: boolean }[];
  issuedThisDuel: string[];
  currentQuestion: ClientQuestion | null;
  currentQuestionAnswer: { bool?: boolean; index?: number } | null;
  /** Last answered question (for client-side feedback) */
  lastQuestion: ClientQuestion | null;
  /** Reveal info for the last answered question (safe after answer) */
  lastAnswer: {
    questionId: string;
    correct: boolean;
    correctIndex?: number;
    answerBool?: boolean;
    pickedIndex?: number;
    pickedBool?: boolean;
    scoreKind: AnswerLogEntry["scoreKind"];
  } | null;
  /** Score delta from the last answer (positive or negative). */
  lastScoreDelta: number | null;
  /** Player HP delta from the last answer (positive heal or negative damage). */
  lastPlayerHpDelta: number | null;
  /** Boss HP delta from the last answer (negative when boss takes damage). */
  lastBossHpDelta: number | null;
  /** Timestamp for the last answer feedback. */
  lastAnswerAtMs: number | null;
  /**
   * Wheel (10): outcome of the last spin, for immediate UI. Cleared on the next graded answer.
   */
  lastWheelOutcome: LastWheelOutcome | null;
  /**
   * When set together with lastScoreDelta / lastPlayerHpDelta / lastBossHpDelta, drives HUD floaters
   * after a booster is consumed (not an answer). Cleared when submitAnswer runs.
   */
  lastPowerUpFeedbackAtMs: number | null;
  answerLog: AnswerLogEntry[];
  answerHistory: AnswerHistoryEntry[];
  powerUpsUsed: number;
  bossesReached: number;
  bossesDefeated: number;
  runScore: number;
  wrongCount: number;
  topicMissCounts: Record<string, number>;
  shownAtMs: number | null;
  /** AI question source balancing counters (batch-level 50/50 seed vs live). */
  aiQuestionMix?: { seed: number; live: number };
  /** Recently used seed fact ids to avoid immediate repeats in-session (legacy question-ai route). */
  aiRecentSeedFactIds?: string[];
  /** Recently used bank question ids for prepare-run dedup across sessions. */
  aiRecentBankQuestionIds?: string[];
  /** Questions generated before run start, consumed boss-by-boss during gameplay. */
  preGeneratedQuestionsByBoss?: Record<string, PreparedGameQuestion[]>;

  /** Card 0: The Fool — next answer auto-correct, 0 pts */
  activeFoolNext: boolean;
  /** Card 1: The Magician — discard current Q, issue new one */
  activeMagicianReroll: boolean;
  /** Card 2: The High Priestess — eliminate a wrong MCQ option next Q */
  activeHighPriestessNext: boolean;
  /** Card 4: The Emperor — next wrong deals half damage */
  activeEmperorNext: boolean;
  /** Card 5: The Hierophant — next correct +5 bonus damage to boss */
  activeHierophantNext: boolean;
  /** Hierophant: panel copy for the armed +5 bonus while active */
  hierophantHint: string | null;
  /** Card 6: The Lovers — next correct=double boss dmg; next wrong=double self-dmg */
  activeLoversNext: boolean;
  /** Card 7: The Chariot — next correct +10 bonus; next wrong +5 extra self-dmg */
  activeChariotNext: boolean;
  /** Card 8: Strength — next wrong deals 0 damage */
  activeStrengthNext: boolean;
  /** Card 10: Wheel of Fortune — double-or-nothing variant active */
  activeWheelNext: boolean;
  /** Card 10: Wheel of Fortune — free auto-correct (0 pts) */
  activeWheelAutoNext: boolean;
  /** Card 11: Justice — currently swapped (processed inline) */
  activeJusticeNext: boolean;
  /** Card 12: The Hanged Man — when true, the current question’s timer was extended by +10s (server flag) */
  activeHangedManPeek: boolean;
  /** Card 14: Temperance — next wrong splits damage 50/50 */
  activeTemperanceNext: boolean;
  /** Card 15: The Devil — rounds remaining with ±50% damage */
  activeDevilRoundsLeft: number;
  /** Card 18: The Moon — correct answer gets +20 bonus damage */
  activeMoonNext: boolean;
  /** Card 19: The Sun — MCQ correct option border hint */
  activeSunNext: boolean;
  /** Card 21: The World — next answer auto-correct, half points, normal damage */
  pendingWorldAuto: boolean;
}

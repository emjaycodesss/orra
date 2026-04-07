export type QuestionType = "tf" | "mcq";

export interface BankQuestion {
  id: string;
  type: QuestionType;
  stem: string;
  topic: string;
  tiers: number[];
  answerBool?: boolean;
  options?: string[];
  correctIndex?: number;
}

export interface ClientQuestion {
  id: string;
  type: QuestionType;
  stem: string;
  options?: string[];
}

export interface AnswerLogEntry {
  questionId: string;
  correct: boolean;
  bossIndex: number;
  latencyMs: number;
  scoreKind: "normal" | "fool" | "world";
}

export interface GameSession {
  id: string;
  createdAt: number;
  walletAddress: string | null;
  twitterHandle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  phase: "lobby" | "running" | "ended";
  bossIndex: number;
  questionsInDuel: number;
  playerHp: number;
  oppHp: number;
  suddenDeath: boolean;
  /** One TF after 7-question cap when HP was tied */
  awaitingSuddenDeath: boolean;
  judgementUsed: boolean;
  boosters: { majorIndex: number; used: boolean }[];
  issuedThisDuel: string[];
  currentQuestion: ClientQuestion | null;
  currentQuestionAnswer: { bool?: boolean; index?: number } | null;
  answerLog: AnswerLogEntry[];
  powerUpsUsed: number;
  bossesReached: number;
  bossesDefeated: number;
  runScore: number;
  wrongCount: number;
  topicMissCounts: Record<string, number>;
  shownAtMs: number | null;
  activeFoolNext: boolean;
  activeStrengthNext: boolean;
  pendingWorldAuto: boolean;
}

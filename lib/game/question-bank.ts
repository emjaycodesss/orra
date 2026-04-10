import type { BankQuestion, ClientQuestion, PreparedGameQuestion } from "./types";
import rawBank from "./questions/bank.json";

const bank = rawBank as BankQuestion[];

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Picks distinct bank rows for prepare-run (boss-scoped), excluding session-recent ids.
 */
export function pickBankQuestionsForPrepare(params: {
  bossIndex: 0 | 1 | 2;
  count: number;
  excludeIds: Set<string>;
}): BankQuestion[] {
  const pool = bank.filter(
    (q) => q.bossIndex === params.bossIndex && !params.excludeIds.has(q.id),
  );
  const copy = [...pool];
  shuffleInPlace(copy);
  return copy.slice(0, params.count);
}

/** Snapshot bank content into a prepared row (engine grades from embedded answers). */
export function bankQuestionToPrepared(q: BankQuestion, bossIndex: 0 | 1 | 2): PreparedGameQuestion {
  return {
    id: q.id,
    bossIndex,
    type: q.type,
    stem: q.stem,
    options: q.type === "mcq" ? [...(q.options ?? [])].slice(0, 4) : undefined,
    correctIndex: q.type === "mcq" ? Math.max(0, Math.min(3, q.correctIndex ?? 0)) : undefined,
    answerBool: q.type === "tf" ? Boolean(q.answerBool) : undefined,
    sourceMode: "seed",
    source: "bank",
    topic: q.topic,
  };
}

export function getQuestionById(id: string): BankQuestion | undefined {
  return bank.find((q) => q.id === id);
}

export function tierForBoss(bossIndex: number): number {
  if (bossIndex <= 0) return 1;
  if (bossIndex === 1) return 2;
  return 3;
}

export function pickRandomTf(issuedThisDuel: string[]): BankQuestion | null {
  const pool = bank.filter(
    (q) => q.type === "tf" && !issuedThisDuel.includes(q.id),
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * Boss-scoped TF; if the pool is empty, falls back to adjacent bosses only (no global cross-tier jumps).
 */
export function pickRandomTfForBoss(
  bossIndex: number,
  issuedThisDuel: string[],
): BankQuestion | null {
  const targetTier = tierForBoss(bossIndex);
  const pool = bank.filter((q) => {
    if (q.type !== "tf" || issuedThisDuel.includes(q.id)) return false;
    if (q.bossIndex !== undefined) return q.bossIndex === bossIndex;
    return q.tiers?.includes(targetTier) ?? false;
  });
  if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)]!;

  const adjacent = [bossIndex - 1, bossIndex + 1].filter((b) => b >= 0 && b <= 2);
  const adjacentPool = bank.filter((q) => {
    if (q.type !== "tf" || issuedThisDuel.includes(q.id)) return false;
    if (q.bossIndex !== undefined) return adjacent.includes(q.bossIndex);
    return adjacent.some((b) => q.tiers?.includes(tierForBoss(b)) ?? false);
  });
  if (adjacentPool.length === 0) return null;
  return adjacentPool[Math.floor(Math.random() * adjacentPool.length)]!;
}

/** Next bank row for the duel; uses the same adjacent-boss fallback as `pickRandomTfForBoss` when empty. */
export function pickNextQuestion(
  bossIndex: number,
  issuedThisDuel: string[],
  options?: { forceBossIndex?: number; forceType?: "tf" | "mcq" },
): BankQuestion | null {
  const targetBoss = options?.forceBossIndex !== undefined ? options.forceBossIndex : bossIndex;

  let pool = bank.filter((q) => {
    if (issuedThisDuel.includes(q.id)) return false;
    if (q.bossIndex !== undefined) return q.bossIndex === targetBoss;
    const tier = tierForBoss(targetBoss);
    return q.tiers?.includes(tier) ?? false;
  });

  if (options?.forceType) {
    pool = pool.filter((q) => q.type === options.forceType);
  }

  if (pool.length === 0) {
    const adjacent = [targetBoss - 1, targetBoss + 1].filter((b) => b >= 0 && b <= 2);
    const fallback = bank.filter((q) => {
      if (issuedThisDuel.includes(q.id)) return false;
      if (options?.forceType && q.type !== options.forceType) return false;
      if (q.bossIndex !== undefined) return adjacent.includes(q.bossIndex);
      return adjacent.some((b) => q.tiers?.includes(tierForBoss(b)) ?? false);
    });
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)]!;
  }

  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** For The Hermit (card 9): pick from a lower boss tier. */
export function pickLowerTierQuestion(
  bossIndex: number,
  issuedThisDuel: string[],
): BankQuestion | null {
  return pickNextQuestion(bossIndex, issuedThisDuel, {
    forceBossIndex: Math.max(0, bossIndex - 1),
  });
}

export function toClientQuestion(q: BankQuestion): ClientQuestion {
  if (q.type === "tf") {
    return { id: q.id, type: "tf", stem: q.stem };
  }
  return { id: q.id, type: "mcq", stem: q.stem, options: [...(q.options ?? [])] };
}

export function gradeAnswer(
  q: BankQuestion,
  boolChoice?: boolean,
  choiceIndex?: number,
): boolean {
  if (q.type === "tf") return boolChoice === q.answerBool;
  return choiceIndex === q.correctIndex;
}

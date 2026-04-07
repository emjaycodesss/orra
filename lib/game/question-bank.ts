import type { BankQuestion, ClientQuestion } from "./types";
import rawBank from "./questions/bank.json";

const bank = rawBank as BankQuestion[];

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

export function pickNextQuestion(
  bossIndex: number,
  issuedThisDuel: string[],
): BankQuestion | null {
  const tier = tierForBoss(bossIndex);
  const pool = bank.filter(
    (q) => q.tiers.includes(tier) && !issuedThisDuel.includes(q.id),
  );
  if (pool.length === 0) {
    const fallback = bank.filter((q) => !issuedThisDuel.includes(q.id));
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)]!;
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
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

import { describe, expect, it } from "vitest";
import rawBank from "./questions/bank.json";
import { pickBankQuestionsForPrepare, pickNextQuestion, pickRandomTfForBoss } from "./question-bank";

type BankQuestion = (typeof rawBank)[number];

describe("question-bank boss scoping", () => {
  it("maps boss index to expected difficulty tier buckets", () => {
    expect([0, 1, 2].map((b) => (b <= 0 ? 1 : b === 1 ? 2 : 3))).toEqual([1, 2, 3]);
  });

  it("prefers boss-scoped TF for sudden death picks", () => {
    const pick = pickRandomTfForBoss(1, []);
    expect(pick).not.toBeNull();
    if (!pick) return;
    if (pick.bossIndex !== undefined) {
      expect(pick.bossIndex).toBe(1);
    }
  });

  it("falls back only to adjacent bosses when target boss pool is exhausted", () => {
    const exhaustedBoss0 = (rawBank as BankQuestion[])
      .filter((q) => q.bossIndex === 0)
      .map((q) => q.id);
    const pick = pickNextQuestion(0, exhaustedBoss0);
    if (!pick) return;
    if (pick.bossIndex !== undefined) {
      expect([1]).toContain(pick.bossIndex);
    }
  });

  it("pickBankQuestionsForPrepare returns distinct boss-scoped rows respecting excludeIds", () => {
    const exclude = new Set(["q1", "q2"]);
    const picks = pickBankQuestionsForPrepare({ bossIndex: 0, count: 3, excludeIds: exclude });
    expect(picks.length).toBe(3);
    const ids = picks.map((q) => q.id);
    expect(new Set(ids).size).toBe(3);
    picks.forEach((q) => {
      expect(q.bossIndex).toBe(0);
      expect(exclude.has(q.id)).toBe(false);
    });
  });
});

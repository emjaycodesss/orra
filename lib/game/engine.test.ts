import { describe, expect, it, vi } from "vitest";
import {
  applyComboDamage,
  applyDuelCombo,
  applyPowerUp,
  createLobbySession,
  startQuestionClockIfDeferred,
  startRun,
  submitAnswer,
} from "./engine";
import { QUESTION_BUDGET_SEC } from "./question-timer";
import type { GameSession } from "./types";
import * as questionBank from "./question-bank";
import { getQuestionById, tierForBoss, toClientQuestion } from "./question-bank";
import rawBank from "./questions/bank.json";
import { bossClearBonus, hpEndOfDuelBonus } from "./scoring";

function sessionWithCard(cardIndex: number) {
  return startRun(createLobbySession(`t-${cardIndex}`), [cardIndex, 0, 1]);
}

function firstQuestionByType(type: "tf" | "mcq", bossIndex: 0 | 1 | 2) {
  const q = (rawBank as Array<{
    id: string;
    type: "tf" | "mcq";
    bossIndex?: 0 | 1 | 2;
    tiers?: number[];
  }>).find((x) => {
    if (x.type !== type) return false;
    if (x.bossIndex !== undefined) return x.bossIndex === bossIndex;
    return x.tiers?.includes(tierForBoss(bossIndex)) ?? false;
  });
  return q ?? null;
}

describe("question clock (boss intro deferral)", () => {
  it("defers shownAtMs for the first question of a duel segment", () => {
    const s = startRun(createLobbySession("t-qclock-1"), [0, 1, 2]);
    expect(s.currentQuestion).not.toBeNull();
    expect(s.shownAtMs).toBeNull();
  });

  it("stamps shownAtMs via startQuestionClockIfDeferred", () => {
    let s = startRun(createLobbySession("t-qclock-2"), [0, 1, 2]);
    s = startQuestionClockIfDeferred(s);
    expect(s.shownAtMs).not.toBeNull();
  });

  it("stamps shownAtMs immediately when dealing the second question in a segment", () => {
    let s = startRun(createLobbySession("t-qclock-3"), [0, 1, 2]);
    s = startQuestionClockIfDeferred(s);
    s = answerGrade(s, true);
    expect(s.questionsInDuel).toBe(1);
    expect(s.currentQuestion).not.toBeNull();
    expect(s.shownAtMs).not.toBeNull();
  });
});

describe("The Hanged Man (+10s question clock)", () => {
  it("moves shownAtMs forward 10s when 20s have elapsed on the 30s budget", () => {
    const row = firstQuestionByType("mcq", 0);
    expect(row).not.toBeNull();
    const b = getQuestionById(row!.id)!;
    const base = sessionWithCard(12);
    const oldShown = Date.now() - 20_000;
    const s: GameSession = {
      ...base,
      currentQuestion: toClientQuestion(b),
      currentQuestionAnswer: { index: b.correctIndex },
      shownAtMs: oldShown,
    };
    const n = applyPowerUp(s, 0);
    const slack = 150;
    expect(Math.abs(n.shownAtMs! - (oldShown + 10_000))).toBeLessThanOrEqual(slack);
    expect(n.shownAtMs!).toBeLessThanOrEqual(Date.now() + slack);
  });

  it("when deadline was past (0 remain), sets anchor for 10s left on budget", () => {
    const row = firstQuestionByType("mcq", 0);
    expect(row).not.toBeNull();
    const b = getQuestionById(row!.id)!;
    const base = sessionWithCard(12);
    const t0 = Date.now();
    const oldShown = t0 - (QUESTION_BUDGET_SEC + 5) * 1000;
    const s: GameSession = {
      ...base,
      currentQuestion: toClientQuestion(b),
      currentQuestionAnswer: { index: b.correctIndex },
      shownAtMs: oldShown,
    };
    const n = applyPowerUp(s, 0);
    const expected = t0 - (QUESTION_BUDGET_SEC - 10) * 1000;
    expect(Math.abs(n.shownAtMs! - expected)).toBeLessThan(250);
  });

  it("with no active question uses defensive shownAtMs (10s remaining on budget)", () => {
    const base = startRun(createLobbySession("t-hanged-def"), [12, 0, 1]);
    const t0 = Date.now();
    const cleared: GameSession = {
      ...base,
      currentQuestion: null,
      currentQuestionAnswer: null,
      shownAtMs: null,
    };
    const n = applyPowerUp(cleared, 0);
    const expected = t0 - (QUESTION_BUDGET_SEC - 10) * 1000;
    expect(Math.abs(n.shownAtMs! - expected)).toBeLessThan(250);
  });
});

describe("engine booster behavior", () => {
  it("does not allow manual Judgement activation to consume slot or score", () => {
    const base = startRun(createLobbySession("t-judgement"), [20, 0, 1]);
    const next = applyPowerUp(base, 0);
    expect(next.runScore).toBe(base.runScore);
    expect(next.boosters[0]?.used).toBe(false);
  });

  it("applies The World as auto-correct with half points", () => {
    const base = sessionWithCard(21);
    const worldArmed = applyPowerUp(base, 0);
    const answered = submitAnswer(worldArmed);

    expect(answered.lastAnswer?.scoreKind).toBe("world");
    expect(answered.lastAnswer?.correct).toBe(true);
    expect(answered.lastScoreDelta).toBe(50);
  });

  it("applies expected runtime flags/effects for representative cards", () => {
    const fool = applyPowerUp(sessionWithCard(0), 0);
    expect(fool.activeFoolNext).toBe(true);

    const empressSeed = { ...sessionWithCard(3), playerHp: 60 };
    const empress = applyPowerUp(empressSeed, 0);
    expect(empress.playerHp).toBe(80);

    const emperor = applyPowerUp(sessionWithCard(4), 0);
    expect(emperor.activeEmperorNext).toBe(true);

    const lovers = applyPowerUp(sessionWithCard(6), 0);
    expect(lovers.activeLoversNext).toBe(true);

    const strength = applyPowerUp(sessionWithCard(8), 0);
    expect(strength.activeStrengthNext).toBe(true);

    const justice = applyPowerUp(sessionWithCard(11), 0);
    expect(justice.currentQuestion?.type).toBe("tf");
    expect(justice.activeJusticeNext).toBe(false);

    const hanged = applyPowerUp(sessionWithCard(12), 0);
    expect(hanged.activeHangedManPeek).toBe(true);
    expect(hanged.playerHp).toBe(95);

    const temperance = applyPowerUp(sessionWithCard(14), 0);
    expect(temperance.activeTemperanceNext).toBe(true);

    const devil = applyPowerUp(sessionWithCard(15), 0);
    expect(devil.activeDevilRoundsLeft).toBe(2);

    const moon = applyPowerUp(sessionWithCard(18), 0);
    expect(moon.activeMoonNext).toBe(true);

    const world = applyPowerUp(sessionWithCard(21), 0);
    expect(world.pendingWorldAuto).toBe(true);
  });

  it("Strength zeros wrong-answer damage (fresh latency avoids Planck wrong ticks)", () => {
    const armed = applyPowerUp(sessionWithCard(8), 0);
    expect(armed.activeStrengthNext).toBe(true);
    const hpBefore = armed.playerHp;
    const run = { ...armed, shownAtMs: Date.now() };
    const cq = run.currentQuestion;
    expect(cq).not.toBeNull();
    const expB = run.currentQuestionAnswer?.bool;
    const expI = run.currentQuestionAnswer?.index;
    const out =
      cq!.type === "tf"
        ? submitAnswer(run, expB === undefined ? true : !expB, undefined)
        : submitAnswer(
            run,
            undefined,
            ((expI ?? 0) + 1) % Math.max(1, cq!.options?.length ?? 4),
          );
    expect(out.playerHp).toBe(hpBefore);
    expect(out.lastPlayerHpDelta).toBe(0);
    expect(out.activeStrengthNext).toBe(false);
  });

  it("Emperor halves the next wrong damage and is not consumed by a correct answer", () => {
    let run = applyPowerUp(sessionWithCard(4), 0);
    expect(run.activeEmperorNext).toBe(true);
    run = { ...run, shownAtMs: Date.now() };
    const afterCorrect = answerGrade(run, true);
    expect(afterCorrect.activeEmperorNext).toBe(true);
    const hpAfterCorrect = afterCorrect.playerHp;
    const afterWrong = answerGrade(afterCorrect, false);
    expect(afterWrong.playerHp).toBe(hpAfterCorrect - 6);
    expect(afterWrong.activeEmperorNext).toBe(false);
  });

  it("Death bypasses Chop shield and Tower clears shield first", () => {
    const chopDeathBase = { ...sessionWithCard(13), bossIndex: 2, oppHp: 120, chopShieldHp: 50 };
    const death = applyPowerUp(chopDeathBase, 0);
    expect(death.oppHp).toBe(110);
    expect(death.chopShieldHp).toBe(50);

    const chopTowerBase = { ...sessionWithCard(16), bossIndex: 2, oppHp: 120, chopShieldHp: 25 };
    const tower = applyPowerUp(chopTowerBase, 0);
    expect(tower.chopShieldHp).toBe(0);
    expect(tower.oppHp).toBe(120);
  });

  it("without Judgement in loadout, first lethal wrong ends the run", () => {
    const run = startRun(createLobbySession("t-no-judge"), [0, 1, 2]);
    const firstBool =
      run.currentQuestion?.type === "tf"
        ? !(run.currentQuestionAnswer?.bool ?? true)
        : undefined;
    const firstIndex = run.currentQuestion?.type === "mcq" ? -1 : undefined;
    const deadly = { ...run, playerHp: 1 };
    const out = submitAnswer(deadly, firstBool, firstIndex);
    expect(out.phase).toBe("ended");
    expect(out.judgementUsed).toBe(false);
  });

  it("Judgement passive revives exactly once when HP drops to zero", () => {
    const run = startRun(createLobbySession("t-revive"), [20, 0, 1]);
    const firstBool =
      run.currentQuestion?.type === "tf"
        ? !(run.currentQuestionAnswer?.bool ?? true)
        : undefined;
    const firstIndex = run.currentQuestion?.type === "mcq" ? -1 : undefined;
    const deadly = { ...run, playerHp: 1 };
    const once = submitAnswer(deadly, firstBool, firstIndex);
    expect(once.playerHp).toBe(1);
    expect(once.judgementUsed).toBe(true);

    const againDeadly = { ...once, phase: "running" as const, playerHp: 1 };
    const nextBool =
      againDeadly.currentQuestion?.type === "tf"
        ? !(againDeadly.currentQuestionAnswer?.bool ?? true)
        : undefined;
    const nextIndex = againDeadly.currentQuestion?.type === "mcq" ? -1 : undefined;
    const twice = submitAnswer(againDeadly, nextBool, nextIndex);
    expect(twice.phase).toBe("ended");
  });

  it("Judgement revive updates lastPlayerHpDelta so HUD reflects surviving HP", () => {
    const run = startRun(createLobbySession("t-judge-delta"), [20, 0, 1]);
    const wrongBool =
      run.currentQuestion?.type === "tf"
        ? !(run.currentQuestionAnswer?.bool ?? true)
        : undefined;
    const wrongIndex = run.currentQuestion?.type === "mcq" ? -1 : undefined;
    const deadly = { ...run, playerHp: 1 };
    const out = submitAnswer(deadly, wrongBool, wrongIndex);
    expect(out.playerHp).toBe(1);
    expect(out.lastPlayerHpDelta).toBe(0);
  });

  it("Magician does not consume slot when no replacement question exists", () => {
    const base = sessionWithCard(1);
    vi.spyOn(questionBank, "pickNextQuestion").mockReturnValue(null);
    const next = applyPowerUp(base, 0);
    vi.restoreAllMocks();
    expect(next.boosters[0]?.used).toBe(false);
    expect(next.runScore).toBe(base.runScore);
    expect(next.activeMagicianReroll).toBe(false);
  });

  it("Hermit does not consume slot when no replacement question exists", () => {
    const base = sessionWithCard(9);
    vi.spyOn(questionBank, "pickNextQuestion").mockReturnValue(null);
    const next = applyPowerUp(base, 0);
    vi.restoreAllMocks();
    expect(next.boosters[0]?.used).toBe(false);
    expect(next.runScore).toBe(base.runScore);
  });

  it("Justice does not consume slot when no TF replacement exists", () => {
    const base = sessionWithCard(11);
    vi.spyOn(questionBank, "pickNextQuestion").mockReturnValue(null);
    const next = applyPowerUp(base, 0);
    vi.restoreAllMocks();
    expect(next.boosters[0]?.used).toBe(false);
    expect(next.runScore).toBe(base.runScore);
  });

  it("Wheel free skip grades as wheel-auto with 0 score delta and 0 boss damage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.65);
    const base = { ...sessionWithCard(10), shownAtMs: Date.now() - 20_000 };
    const run = applyPowerUp(base, 0);
    vi.restoreAllMocks();
    expect(run.lastWheelOutcome).toBe("wheel_free_skip");
    const oppBefore = run.oppHp;
    const scoreBefore = run.runScore;
    const cq = run.currentQuestion;
    expect(cq).not.toBeNull();
    const out = submitAnswer(
      run,
      cq!.type === "tf" ? run.currentQuestionAnswer?.bool : undefined,
      cq!.type === "mcq" ? run.currentQuestionAnswer?.index : undefined,
    );
    expect(out.lastAnswer?.scoreKind).toBe("wheel-auto");
    expect(out.lastScoreDelta).toBe(0);
    expect(out.oppHp).toBe(oppBefore);
    expect(out.runScore).toBe(scoreBefore);
    expect(out.lastWheelOutcome).toBeNull();
  });

  it("Hierophant adds +5 boss damage on correct (Planck)", () => {
    /** Freeze latency high so Planck speed bonus does not add another +5 in this assertion. */
    const run = applyPowerUp(
      { ...startRun(createLobbySession("t-hier"), [5, 0, 1]), shownAtMs: Date.now() - 20_000 },
      0,
    );
    expect(run.activeHierophantNext).toBe(true);
    const cq = run.currentQuestion;
    expect(cq).not.toBeNull();
    const opp0 = run.oppHp;
    const out = submitAnswer(
      run,
      cq!.type === "tf" ? run.currentQuestionAnswer?.bool : undefined,
      cq!.type === "mcq" ? run.currentQuestionAnswer?.index : undefined,
    );
    expect(out.oppHp).toBe(opp0 - 15 - 5);
    expect(out.activeHierophantNext).toBe(false);
  });

  it("Hierophant +5 bypasses Chop shield as true boss HP damage", () => {
    let run = applyPowerUp(startRun(createLobbySession("t-hier-chop"), [5, 0, 1]), 0);
    run = { ...run, bossIndex: 2, oppHp: 120, chopShieldHp: 50 };
    const cq = run.currentQuestion;
    expect(cq).not.toBeNull();
    const out = submitAnswer(
      run,
      cq!.type === "tf" ? run.currentQuestionAnswer?.bool : undefined,
      cq!.type === "mcq" ? run.currentQuestionAnswer?.index : undefined,
    );
    expect(out.chopShieldHp).toBe(35);
    expect(out.oppHp).toBe(115);
  });

  it("all arcana indices 0..21 are executable without crashes", () => {
    for (let cardIndex = 0; cardIndex <= 21; cardIndex += 1) {
      const run = sessionWithCard(cardIndex);
      const next = applyPowerUp(run, 0);
      expect(next).toBeDefined();
      if (cardIndex === 20) {
        expect(next.boosters[0]?.used).toBe(false);
      } else {
        expect(next.boosters[0]?.used).toBe(true);
      }
    }
  });

  it("consumes pre-generated boss questions before static bank", () => {
    const run = sessionWithCard(0);
    const pre = {
      ...run,
      preGeneratedQuestionsByBoss: {
        "0": [
          {
            id: "pre_q_1",
            bossIndex: 0 as const,
            type: "mcq" as const,
            stem: "Pre-generated test question?",
            options: ["A", "B", "C", "D"],
            correctIndex: 1,
            sourceMode: "seed" as const,
            source: "seed-facts-fallback" as const,
          },
        ],
      },
    };
    const answered = submitAnswer(pre, undefined, -1);
    expect(answered.currentQuestion?.id).toBe("pre_q_1");
  });

  it("grades pre-generated question answers from runtime payload without bank lookup", () => {
    const run = sessionWithCard(0);
    const pre = {
      ...run,
      currentQuestion: {
        id: "pre_runtime_only",
        type: "mcq" as const,
        stem: "Runtime-only MCQ",
        options: ["A", "B", "C", "D"],
      },
      currentQuestionAnswer: { index: 2 },
    };
    const answered = submitAnswer(pre, undefined, 2);
    expect(answered.lastAnswer?.questionId).toBe("pre_runtime_only");
    expect(answered.lastAnswer?.correct).toBe(true);
    expect(answered.answerHistory.at(-1)?.correctLabel).toBe("C");
    expect(answered.answerHistory.at(-1)?.pickedLabel).toBe("C");
  });

  it("applies deferred card decorations when dealing pre-generated questions", () => {
    const run = sessionWithCard(0);
    const pre = {
      ...run,
      activeSunNext: true,
      activeHighPriestessNext: true,
      preGeneratedQuestionsByBoss: {
        "0": [
          {
            id: "pre_fx_1",
            bossIndex: 0 as const,
            type: "mcq" as const,
            stem: "Effects should apply here",
            options: ["A", "B", "C", "D"],
            correctIndex: 1,
            sourceMode: "seed" as const,
            source: "seed-facts-fallback" as const,
          },
        ],
      },
    };
    const answered = submitAnswer(pre, undefined, -1);
    expect(answered.currentQuestion?.id).toBe("pre_fx_1");
    expect(answered.currentQuestion?.sunCorrectIndex).toBe(1);
    expect(answered.currentQuestion?.eliminatedIndex).not.toBeUndefined();
    expect(answered.currentQuestion?.eliminatedIndex).not.toBe(1);
  });

  it("applies deferred Sun to the next TF pre-generated question", () => {
    const run = sessionWithCard(0);
    const seededMcq = firstQuestionByType("mcq", 0);
    expect(seededMcq).not.toBeNull();
    const mcqBank = getQuestionById(seededMcq!.id)!;
    const pre = {
      ...run,
      currentQuestion: toClientQuestion(mcqBank),
      currentQuestionAnswer: { index: mcqBank.correctIndex },
      activeSunNext: true,
      preGeneratedQuestionsByBoss: {
        "0": [
          {
            id: "pre_tf_sun",
            bossIndex: 0 as const,
            type: "tf" as const,
            stem: "Deferred Sun should outline TF",
            answerBool: false,
            sourceMode: "seed" as const,
            source: "seed-facts-fallback" as const,
          },
        ],
      },
    };
    const wrongIdx =
      typeof mcqBank.correctIndex === "number" && mcqBank.correctIndex > 0 ? 0 : 1;
    const answered = submitAnswer(pre, undefined, wrongIdx);
    expect(answered.currentQuestion?.id).toBe("pre_tf_sun");
    expect(answered.currentQuestion?.sunCorrectBool).toBe(false);
  });

  it("Justice replaces current MCQ with TF immediately", () => {
    const base = sessionWithCard(11);
    const seededMcq = firstQuestionByType("mcq", 0);
    expect(seededMcq).not.toBeNull();
    if (!seededMcq) return;

    const mcqBank = getQuestionById(seededMcq.id)!;
    const prepared = {
      ...base,
      currentQuestion: toClientQuestion(mcqBank),
      currentQuestionAnswer: { bool: mcqBank.answerBool, index: mcqBank.correctIndex },
    };

    const armed = applyPowerUp(prepared, 0);
    expect(armed.activeJusticeNext).toBe(false);
    expect(armed.currentQuestion?.type).toBe("tf");
  });

  it("Magician consumes prepared queue before bank", () => {
    const base = sessionWithCard(1);
    const pre = {
      ...base,
      preGeneratedQuestionsByBoss: {
        "0": [
          {
            id: "pre_mag_1",
            bossIndex: 0 as const,
            type: "mcq" as const,
            stem: "Prepared magician swap?",
            options: ["A", "B", "C", "D"],
            correctIndex: 0,
            sourceMode: "seed" as const,
            source: "template-seed" as const,
          },
        ],
      },
    };
    const next = applyPowerUp(pre, 0);
    expect(next.currentQuestion?.id).toBe("pre_mag_1");
    expect(next.preGeneratedQuestionsByBoss?.["0"]?.length ?? 0).toBe(0);
    expect(next.activeMagicianReroll).toBe(true);
  });

  it("Hermit swaps to lower-tier pool and never upgrades difficulty tier", () => {
    const base = sessionWithCard(9);
    const seeded = firstQuestionByType("mcq", 1);
    expect(seeded).not.toBeNull();
    if (!seeded) return;

    const seedBank = getQuestionById(seeded.id)!;
    const prepared = {
      ...base,
      bossIndex: 1 as const,
      currentQuestion: toClientQuestion(seedBank),
      currentQuestionAnswer: { bool: seedBank.answerBool, index: seedBank.correctIndex },
    };

    const swapped = applyPowerUp(prepared, 0);
    expect(swapped.currentQuestion).not.toBeNull();
    const swappedBank = getQuestionById(swapped.currentQuestion!.id);
    expect(swappedBank).toBeDefined();
    if (!swappedBank) return;

    if (swappedBank.bossIndex !== undefined) {
      expect(swappedBank.bossIndex).toBe(0);
    } else {
      expect(swappedBank.tiers?.includes(1)).toBe(true);
    }
  });
});

function answerGrade(run: ReturnType<typeof startRun>, correct: boolean): ReturnType<typeof submitAnswer> {
  const cq = run.currentQuestion;
  if (!cq) throw new Error("missing question");
  const expB = run.currentQuestionAnswer?.bool;
  const expI = run.currentQuestionAnswer?.index;
  if (cq.type === "tf") {
    if (correct) return submitAnswer(run, expB, undefined);
    return submitAnswer(run, expB === undefined ? true : !expB, undefined);
  }
  const n = cq.options?.length ?? 4;
  if (correct) return submitAnswer(run, undefined, expI ?? 0);
  const wrong = ((expI ?? 0) + 1) % Math.max(1, n);
  return submitAnswer(run, undefined, wrong);
}

describe("duel overtime and combo", () => {
  it("entering Chop duel initializes shield to full", () => {
    const base = sessionWithCard(0);
    const run = {
      ...base,
      bossIndex: 1 as const,
      oppHp: 1,
      playerHp: 100,
    };
    const cq = run.currentQuestion;
    expect(cq).not.toBeNull();
    const out = submitAnswer(
      run,
      cq!.type === "tf" ? run.currentQuestionAnswer?.bool : undefined,
      cq!.type === "mcq" ? run.currentQuestionAnswer?.index : undefined,
    );
    expect(out.bossIndex).toBe(2);
    expect(out.chopShieldHp).toBe(50);
  });

  it("Chop shield absorbs normal damage before boss HP", () => {
    const run = {
      ...sessionWithCard(0),
      bossIndex: 2 as const,
      oppHp: 120,
      chopShieldHp: 50,
    };
    const cq = run.currentQuestion;
    expect(cq).not.toBeNull();
    const out = submitAnswer(
      run,
      cq!.type === "tf" ? run.currentQuestionAnswer?.bool : undefined,
      cq!.type === "mcq" ? run.currentQuestionAnswer?.index : undefined,
    );
    expect(out.chopShieldHp).toBe(35);
    expect(out.oppHp).toBe(120);
  });

  it("Chop shield overflow damage spills into boss HP", () => {
    const run = {
      ...sessionWithCard(0),
      bossIndex: 2 as const,
      oppHp: 120,
      chopShieldHp: 5,
    };
    const cq = run.currentQuestion;
    expect(cq).not.toBeNull();
    const out = submitAnswer(
      run,
      cq!.type === "tf" ? run.currentQuestionAnswer?.bool : undefined,
      cq!.type === "mcq" ? run.currentQuestionAnswer?.index : undefined,
    );
    expect(out.chopShieldHp).toBe(0);
    expect(out.oppHp).toBe(110);
  });

  it("sudden-death correct vs Chop shield does not auto-win when boss survives", () => {
    const run = {
      ...sessionWithCard(0),
      bossIndex: 2 as const,
      oppHp: 120,
      chopShieldHp: 50,
      suddenDeath: true,
      awaitingSuddenDeath: true,
    };
    const cq = run.currentQuestion;
    expect(cq).not.toBeNull();
    const out = submitAnswer(
      run,
      cq!.type === "tf" ? run.currentQuestionAnswer?.bool : undefined,
      cq!.type === "mcq" ? run.currentQuestionAnswer?.index : undefined,
    );
    expect(out.phase).toBe("running");
    expect(out.bossIndex).toBe(2);
    expect(out.chopShieldHp).toBe(35);
    expect(out.oppHp).toBe(120);
    expect(out.awaitingSuddenDeath).toBe(false);
    expect(out.suddenDeath).toBe(false);
    expect(out.currentQuestion).not.toBeNull();
  });

  it("combo damage helper subtracts hp without auto-defeat when non-lethal", () => {
    const next = applyComboDamage({ oppHp: 72, comboDamageHp: 35, bossMaxHp: 90 });
    expect(next.oppHp).toBe(37);
    expect(next.bossDefeated).toBe(false);
  });

  it("combo damage helper flags defeat when hp reaches zero", () => {
    const next = applyComboDamage({ oppHp: 30, comboDamageHp: 35, bossMaxHp: 90 });
    expect(next.oppHp).toBe(0);
    expect(next.bossDefeated).toBe(true);
  });

  it("after 7 questions, continues when guardian still has HP", () => {
    let s = startRun(createLobbySession("t-overtime-cap"), [0, 1, 2]);
    const pattern = [true, true, true, true, true, false, false];
    for (const c of pattern) {
      /** High latency avoids Planck’s sub‑10s damage bonus (would kill the boss before Q7). */
      s = answerGrade({ ...s, shownAtMs: Date.now() - 20_000 }, c);
    }
    expect(s.questionsInDuel).toBe(7);
    expect(s.oppHp).toBeGreaterThan(0);
    expect(s.phase).toBe("running");
    expect(s.currentQuestion).not.toBeNull();
  });

  it("applyDuelCombo is a no-op when heat below max", () => {
    const run = startRun(createLobbySession("t-fin-deny"), [0, 1, 2]);
    const s = { ...run, duelHeat: 80 };
    const out = applyDuelCombo(s, 35);
    expect(out).toBe(s);
  });

  it("applyDuelCombo applies non-lethal combo damage and keeps duel running", () => {
    const s = {
      ...startRun(createLobbySession("t-fin-combo-nonlethal"), [0, 1, 2]),
      bossIndex: 0 as const,
      oppHp: 72,
      duelHeat: 100,
    };
    const out = applyDuelCombo(s, 35);
    expect(out.phase).toBe("running");
    expect(out.oppHp).toBe(37);
    expect(out.duelHeat).toBe(0);
    expect(out.lastScoreDelta).toBe(0);
  });

  it("applyDuelCombo lethal path adds clear bonuses into lastScoreDelta (HUD floaters)", () => {
    let s = startRun(createLobbySession("t-fin-combo-lethal-delta"), [0, 1, 2]);
    s = { ...s, bossIndex: 0 as const, oppHp: 35, duelHeat: 100 };
    const playerHpBeforeClear = s.playerHp;
    const out = applyDuelCombo(s, 35);
    expect(out.bossIndex).toBe(1);
    expect(out.bossesDefeated).toBe(1);
    expect(out.lastScoreDelta).toBe(
      bossClearBonus() + hpEndOfDuelBonus(playerHpBeforeClear),
    );
  });

  it("applyDuelCombo defeats final guardian only when combo damage is lethal", () => {
    let s = startRun(createLobbySession("t-fin-chop-shield"), [0, 1, 2]);
    s = {
      ...s,
      bossIndex: 2,
      oppHp: 30,
      chopShieldHp: 50,
      duelHeat: 100,
    };
    const out = applyDuelCombo(s, 35);
    expect(out.phase).toBe("running");
    expect(out.oppHp).toBe(30);
    expect(out.chopShieldHp).toBe(15);
    expect(out.bossesDefeated).toBe(s.bossesDefeated);
    expect(out.duelHeat).toBe(0);
  });

  it("applyDuelCombo defeats Chop when combo reaches HP with no shield", () => {
    let s = startRun(createLobbySession("t-fin-chop-lethal"), [0, 1, 2]);
    s = {
      ...s,
      bossIndex: 2,
      oppHp: 30,
      chopShieldHp: 0,
      duelHeat: 100,
    };
    const playerHpBeforeClear = s.playerHp;
    const out = applyDuelCombo(s, 35);
    expect(out.bossesDefeated).toBe(s.bossesDefeated + 1);
    expect(out.duelHeat).toBe(0);
    expect(out.phase).toBe("ended");
    expect(out.oppHp).toBe(0);
    expect(out.chopShieldHp).toBe(0);
    expect(out.lastScoreDelta).toBe(
      bossClearBonus() + hpEndOfDuelBonus(playerHpBeforeClear),
    );
  });
});

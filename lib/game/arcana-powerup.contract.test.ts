import { describe, expect, it, vi } from "vitest";
import { applyPowerUp, createLobbySession, startRun } from "./engine";
import { getQuestionById, toClientQuestion } from "./question-bank";
import rawBank from "./questions/bank.json";
import type { GameSession } from "./types";
import { stripSecretAnswers } from "./http-session";

function sessionWithCard(cardIndex: number) {
  return startRun(createLobbySession(`arc-${cardIndex}`), [cardIndex, 0, 1]);
}

function firstMcqBoss0() {
  const bank = rawBank as Array<{ id: string; type: string; bossIndex?: 0 | 1 | 2 }>;
  return bank.find((q) => q.type === "mcq" && q.bossIndex === 0) ?? null;
}

function firstTfBoss0() {
  const bank = rawBank as Array<{ id: string; type: string; bossIndex?: 0 | 1 | 2 }>;
  return bank.find((q) => q.type === "tf" && q.bossIndex === 0) ?? null;
}

describe("arcana power-up contract matrix", () => {
  it("0 Fool sets activeFoolNext", () => {
    const n = applyPowerUp(sessionWithCard(0), 0);
    expect(n.activeFoolNext).toBe(true);
    expect(n.boosters[0]?.used).toBe(true);
  });

  it("1 Magician marks reroll and changes question when pool allows", () => {
    const n = applyPowerUp(sessionWithCard(1), 0);
    expect(n.activeMagicianReroll).toBe(true);
    expect(n.currentQuestion).not.toBeNull();
  });

  it("2 High Priestess on MCQ sets eliminatedIndex", () => {
    const row = firstMcqBoss0();
    expect(row).not.toBeNull();
    const b = getQuestionById(row!.id)!;
    const base = sessionWithCard(2);
    const s: GameSession = {
      ...base,
      currentQuestion: toClientQuestion(b),
      currentQuestionAnswer: { index: b.correctIndex },
    };
    const n = applyPowerUp(s, 0);
    expect(n.currentQuestion?.eliminatedIndex).toBeDefined();
    expect(n.currentQuestion?.eliminatedIndex).not.toBe(b.correctIndex);
  });

  it("3 Empress heals +20", () => {
    const base = { ...sessionWithCard(3), playerHp: 50 };
    const n = applyPowerUp(base, 0);
    expect(n.playerHp).toBe(70);
  });

  it("4 Emperor sets flag", () => {
    expect(applyPowerUp(sessionWithCard(4), 0).activeEmperorNext).toBe(true);
  });

  it("5 Hierophant sets hint on question", () => {
    const n = applyPowerUp(sessionWithCard(5), 0);
    expect(n.activeHierophantNext).toBe(true);
    expect(n.currentQuestion?.hierophantHint?.length).toBeGreaterThan(0);
  });

  it("6 Lovers arms flag", () => {
    expect(applyPowerUp(sessionWithCard(6), 0).activeLoversNext).toBe(true);
  });

  it("7 Chariot arms flag", () => {
    expect(applyPowerUp(sessionWithCard(7), 0).activeChariotNext).toBe(true);
  });

  it("8 Strength arms flag", () => {
    expect(applyPowerUp(sessionWithCard(8), 0).activeStrengthNext).toBe(true);
  });

  it("9 Hermit swaps question", () => {
    const before = sessionWithCard(9).currentQuestion?.id;
    const n = applyPowerUp(sessionWithCard(9), 0);
    expect(n.currentQuestion?.id).not.toBe(before);
  });

  it("10 Wheel heal branch", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const base = { ...sessionWithCard(10), playerHp: 80 };
    const n = applyPowerUp(base, 0);
    expect(n.playerHp).toBe(90);
    expect(n.lastWheelOutcome).toBe("wheel_heal10");
    vi.restoreAllMocks();
  });

  it("10 Wheel self-damage branch", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.35);
    const base = { ...sessionWithCard(10), playerHp: 80 };
    const n = applyPowerUp(base, 0);
    expect(n.playerHp).toBe(70);
    expect(n.lastWheelOutcome).toBe("wheel_hurt10");
    vi.restoreAllMocks();
  });

  it("10 Wheel free skip branch", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.65);
    const n = applyPowerUp(sessionWithCard(10), 0);
    expect(n.activeFoolNext).toBe(true);
    expect(n.activeWheelAutoNext).toBe(true);
    expect(n.lastWheelOutcome).toBe("wheel_free_skip");
    vi.restoreAllMocks();
  });

  it("10 Wheel double-or-nothing branch", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.95);
    const n = applyPowerUp(sessionWithCard(10), 0);
    expect(n.activeWheelNext).toBe(true);
    expect(n.lastWheelOutcome).toBe("wheel_double_next");
    vi.restoreAllMocks();
  });

  it("11 Justice yields TF immediately", () => {
    const n = applyPowerUp(sessionWithCard(11), 0);
    expect(n.currentQuestion?.type).toBe("tf");
    expect(n.activeJusticeNext).toBe(false);
  });

  it("12 Hanged Man damages, arms peek, and extends question clock by 10s", () => {
    const row = firstMcqBoss0();
    expect(row).not.toBeNull();
    const b = getQuestionById(row!.id)!;
    const base = sessionWithCard(12);
    const oldShownAtMs = Date.now() - 20_000;
    const s: GameSession = {
      ...base,
      currentQuestion: toClientQuestion(b),
      currentQuestionAnswer: { index: b.correctIndex },
      shownAtMs: oldShownAtMs,
    };
    const n = applyPowerUp(s, 0);
    expect(n.playerHp).toBe(95);
    expect(n.activeHangedManPeek).toBe(true);
    expect(n.shownAtMs).not.toBeNull();
    const slack = 150;
    expect(n.shownAtMs!).toBeLessThanOrEqual(Date.now() + slack);
    expect(Math.abs(n.shownAtMs! - (oldShownAtMs + 10_000))).toBeLessThanOrEqual(slack);
  });

  it("13 Death damages boss through shield", () => {
    const base = { ...sessionWithCard(13), bossIndex: 2, chopShieldHp: 50, oppHp: 100 };
    const n = applyPowerUp(base, 0);
    expect(n.oppHp).toBe(90);
    expect(n.chopShieldHp).toBe(50);
  });

  it("13 Death sets boss HP delta and power-up feedback timestamp", () => {
    const base = {
      ...sessionWithCard(13),
      bossIndex: 0,
      oppHp: 90,
      chopShieldHp: 0,
      runScore: 100,
    };
    const n = applyPowerUp(base, 0);
    expect(n.oppHp).toBe(80);
    expect(n.lastBossHpDelta).toBe(-10);
    expect(n.lastPlayerHpDelta).toBe(0);
    expect(n.lastScoreDelta).toBe(-30);
    expect(n.lastPowerUpFeedbackAtMs).not.toBeNull();
  });

  it("16 Tower shield clear sets feedback for shield change", () => {
    const base = {
      ...sessionWithCard(16),
      bossIndex: 2,
      chopShieldHp: 30,
      oppHp: 100,
      runScore: 50,
    };
    const n = applyPowerUp(base, 0);
    expect(n.chopShieldHp).toBe(0);
    expect(n.lastBossHpDelta).toBe(0);
    expect(n.lastScoreDelta).toBe(-30);
    expect(n.lastPowerUpFeedbackAtMs).not.toBeNull();
  });

  it("8 Strength emits feedback with −30 score when runScore can pay the cost", () => {
    const base = { ...sessionWithCard(8), runScore: 40 };
    const n = applyPowerUp(base, 0);
    expect(n.lastScoreDelta).toBe(-30);
    expect(n.runScore).toBe(10);
    expect(n.lastBossHpDelta).toBe(0);
    expect(n.lastPlayerHpDelta).toBe(0);
    expect(n.lastPowerUpFeedbackAtMs).not.toBeNull();
  });

  it("14 Temperance arms flag", () => {
    expect(applyPowerUp(sessionWithCard(14), 0).activeTemperanceNext).toBe(true);
  });

  it("15 Devil sets rounds", () => {
    expect(applyPowerUp(sessionWithCard(15), 0).activeDevilRoundsLeft).toBe(2);
  });

  it("16 Tower clears shield when up", () => {
    const base = { ...sessionWithCard(16), bossIndex: 2, chopShieldHp: 30, oppHp: 100 };
    const n = applyPowerUp(base, 0);
    expect(n.chopShieldHp).toBe(0);
  });

  it("16 Tower damages boss when no shield", () => {
    const base = { ...sessionWithCard(16), bossIndex: 2, chopShieldHp: 0, oppHp: 100 };
    const n = applyPowerUp(base, 0);
    expect(n.oppHp).toBe(85);
  });

  it("17 Star emergency heal when low HP", () => {
    const base = { ...sessionWithCard(17), playerHp: 20 };
    const n = applyPowerUp(base, 0);
    expect(n.playerHp).toBe(40);
  });

  it("18 Moon mutates stem", () => {
    const n = applyPowerUp(sessionWithCard(18), 0);
    expect(n.activeMoonNext).toBe(true);
    expect(n.currentQuestion?.stem).toMatch(/\[\?\?\?\]/);
  });

  it("19 Sun on MCQ sets sunCorrectIndex", () => {
    const row = firstMcqBoss0();
    expect(row).not.toBeNull();
    const b = getQuestionById(row!.id)!;
    const base = sessionWithCard(19);
    const s: GameSession = {
      ...base,
      currentQuestion: toClientQuestion(b),
      currentQuestionAnswer: { index: b.correctIndex },
    };
    const n = applyPowerUp(s, 0);
    expect(n.currentQuestion?.sunCorrectIndex).toBe(b.correctIndex);
  });

  it("19 Sun on TF sets sunCorrectBool on the current question", () => {
    const row = firstTfBoss0();
    expect(row).not.toBeNull();
    const b = getQuestionById(row!.id)!;
    const base = sessionWithCard(19);
    const s: GameSession = {
      ...base,
      currentQuestion: toClientQuestion(b),
      currentQuestionAnswer: { bool: b.answerBool },
    };
    const n = applyPowerUp(s, 0);
    expect(n.activeSunNext).toBe(false);
    expect(n.currentQuestion?.sunCorrectBool).toBe(b.answerBool);
  });

  it("20 Judgement does not mutate session reference path", () => {
    const base = sessionWithCard(20);
    const n = applyPowerUp(base, 0);
    expect(n).toBe(base);
    expect(n.boosters[0]?.used).toBe(false);
  });

  it("21 World arms pending auto-correct", () => {
    expect(applyPowerUp(sessionWithCard(21), 0).pendingWorldAuto).toBe(true);
  });

  it("stripSecretAnswers removes answer payload for API parity", () => {
    const s = sessionWithCard(0);
    const pub = stripSecretAnswers(s);
    expect(pub).not.toHaveProperty("currentQuestionAnswer");
  });
});

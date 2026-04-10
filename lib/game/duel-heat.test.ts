import { describe, expect, it } from "vitest";
import {
  addDuelHeatAfterAnswer,
  DUEL_HEAT_MAX,
  DUEL_HEAT_PER_CORRECT,
  DUEL_HEAT_ZERO_BOSS_DAMAGE_CORRECT,
  isDuelHeatActive,
} from "./duel-heat";
import type { GameSession } from "./types";

function baseSession(over: Partial<GameSession> = {}): GameSession {
  return {
    id: "t",
    createdAt: 0,
    revision: 0,
    walletAddress: null,
    twitterHandle: null,
    displayName: null,
    avatarUrl: null,
    phase: "running",
    bossIndex: 0,
    questionsInDuel: 1,
    playerHp: 50,
    oppHp: 50,
    chopShieldHp: 0,
    duelHeat: 0,
    suddenDeath: false,
    awaitingSuddenDeath: false,
    judgementUsed: false,
    boosters: [],
    issuedThisDuel: [],
    currentQuestion: null,
    currentQuestionAnswer: null,
    lastQuestion: null,
    lastAnswer: null,
    lastScoreDelta: null,
    lastPlayerHpDelta: null,
    lastBossHpDelta: null,
    lastAnswerAtMs: null,
    lastWheelOutcome: null,
    lastPowerUpFeedbackAtMs: null,
    answerLog: [],
    answerHistory: [],
    powerUpsUsed: 0,
    bossesReached: 1,
    bossesDefeated: 0,
    runScore: 0,
    wrongCount: 0,
    topicMissCounts: {},
    shownAtMs: null,
    activeFoolNext: false,
    activeMagicianReroll: false,
    activeHighPriestessNext: false,
    activeEmperorNext: false,
    activeHierophantNext: false,
    hierophantHint: null,
    activeLoversNext: false,
    activeChariotNext: false,
    activeStrengthNext: false,
    activeWheelNext: false,
    activeWheelAutoNext: false,
    activeJusticeNext: false,
    activeHangedManPeek: false,
    activeTemperanceNext: false,
    activeDevilRoundsLeft: 0,
    activeMoonNext: false,
    activeSunNext: false,
    pendingWorldAuto: false,
    ...over,
  } as GameSession;
}

describe("duel-heat", () => {
  it("isDuelHeatActive requires running and both HP positive", () => {
    expect(isDuelHeatActive(baseSession())).toBe(true);
    expect(isDuelHeatActive(baseSession({ phase: "ended" }))).toBe(false);
    expect(isDuelHeatActive(baseSession({ playerHp: 0 }))).toBe(false);
    expect(isDuelHeatActive(baseSession({ oppHp: 0 }))).toBe(false);
  });

  it("wrong answer adds no heat", () => {
    const s = addDuelHeatAfterAnswer(baseSession({ duelHeat: 40 }), {
      correct: false,
      scoreKind: "normal",
    });
    expect(s.duelHeat).toBe(40);
  });

  it("correct normal answer adds DUEL_HEAT_PER_CORRECT and clamps", () => {
    let s = addDuelHeatAfterAnswer(baseSession({ duelHeat: 0 }), {
      correct: true,
      scoreKind: "normal",
    });
    expect(s.duelHeat).toBe(DUEL_HEAT_PER_CORRECT);
    s = addDuelHeatAfterAnswer(baseSession({ duelHeat: 95 }), {
      correct: true,
      scoreKind: "normal",
    });
    expect(s.duelHeat).toBe(DUEL_HEAT_MAX);
  });

  it("fool and wheel-auto use smaller heat increment", () => {
    const fool = addDuelHeatAfterAnswer(baseSession(), {
      correct: true,
      scoreKind: "fool",
    });
    expect(fool.duelHeat).toBe(DUEL_HEAT_ZERO_BOSS_DAMAGE_CORRECT);
    const wa = addDuelHeatAfterAnswer(baseSession(), {
      correct: true,
      scoreKind: "wheel-auto",
    });
    expect(wa.duelHeat).toBe(DUEL_HEAT_ZERO_BOSS_DAMAGE_CORRECT);
  });
});

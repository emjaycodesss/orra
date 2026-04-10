import { describe, expect, it } from "vitest";
import {
  mergePublicSessionForAnswerBossDefeatReveal,
  mergePublicSessionFromServer,
  type PublicGameSession,
} from "./merge-public-session";

function minimalSession(
  overrides: Partial<PublicGameSession> & Pick<PublicGameSession, "id" | "revision">,
): PublicGameSession {
  const base: PublicGameSession = {
    id: overrides.id,
    revision: overrides.revision,
    createdAt: 0,
    walletAddress: null,
    twitterHandle: null,
    displayName: null,
    avatarUrl: null,
    phase: "lobby",
    bossIndex: 0,
    questionsInDuel: 0,
    playerHp: 100,
    oppHp: 100,
    chopShieldHp: 0,
    duelHeat: 0,
    suddenDeath: false,
    awaitingSuddenDeath: false,
    judgementUsed: false,
    boosters: [],
    issuedThisDuel: [],
    currentQuestion: null,
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
    bossesReached: 0,
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
  };
  return { ...base, ...overrides };
}

describe("mergePublicSessionFromServer", () => {
  it("returns incoming when prev is null", () => {
    const incoming = minimalSession({ id: "fresh", revision: 0, phase: "lobby" });
    expect(mergePublicSessionFromServer(null, incoming)).toBe(incoming);
  });

  it("accepts incoming when session id differs (server rotated cookie)", () => {
    const prev = minimalSession({ id: "old", revision: 50, phase: "running" });
    const incoming = minimalSession({ id: "new", revision: 0, phase: "lobby" });
    expect(mergePublicSessionFromServer(prev, incoming)).toBe(incoming);
  });

  it("keeps prev when same id and incoming revision is lower", () => {
    const prev = minimalSession({ id: "same", revision: 10, phase: "running" });
    const incoming = minimalSession({ id: "same", revision: 9, phase: "running" });
    expect(mergePublicSessionFromServer(prev, incoming)).toBe(prev);
  });

  it("accepts incoming when same id and incoming revision is greater or equal", () => {
    const prev = minimalSession({ id: "same", revision: 10, phase: "running" });
    const incoming = minimalSession({ id: "same", revision: 11, phase: "running" });
    expect(mergePublicSessionFromServer(prev, incoming)).toBe(incoming);
  });

  it("accepts incoming when same id and revisions are equal", () => {
    const prev = minimalSession({ id: "same", revision: 10, phase: "running" });
    const incoming = minimalSession({ id: "same", revision: 10, phase: "running" });
    expect(mergePublicSessionFromServer(prev, incoming)).toBe(incoming);
  });
});

describe("mergePublicSessionForAnswerBossDefeatReveal", () => {
  it("keeps latest guardian frame but takes incoming grading and answer log", () => {
    const latest = minimalSession({
      id: "s",
      revision: 5,
      phase: "running",
      bossIndex: 0,
      playerHp: 80,
      oppHp: 5,
      chopShieldHp: 0,
      bossesDefeated: 0,
      currentQuestion: { id: "q1", type: "tf", stem: "Test?", options: undefined },
      shownAtMs: 1000,
      duelHeat: 50,
    });
    const incoming = minimalSession({
      id: "s",
      revision: 6,
      phase: "running",
      bossIndex: 1,
      playerHp: 80,
      oppHp: 100,
      chopShieldHp: 0,
      bossesDefeated: 1,
      currentQuestion: null,
      shownAtMs: null,
      duelHeat: 0,
      answerLog: [
        {
          questionId: "q1",
          correct: true,
          bossIndex: 0,
          latencyMs: 12,
          scoreKind: "normal",
        },
      ],
      lastBossHpDelta: -5,
      lastPlayerHpDelta: 0,
      lastScoreDelta: 10,
      lastAnswerAtMs: 2000,
    });
    const merged = mergePublicSessionForAnswerBossDefeatReveal(latest, incoming);
    expect(merged.bossIndex).toBe(0);
    expect(merged.oppHp).toBe(5);
    expect(merged.playerHp).toBe(80);
    expect(merged.bossesDefeated).toBe(0);
    expect(merged.currentQuestion).toEqual(latest.currentQuestion);
    expect(merged.shownAtMs).toBe(1000);
    expect(merged.duelHeat).toBe(50);
    expect(merged.answerLog).toEqual(incoming.answerLog);
    expect(merged.lastBossHpDelta).toBe(-5);
    expect(merged.revision).toBe(6);
  });

  it("final guardian lethal: keep phase running and server HP/defeats until arena KO merges", () => {
    const latest = minimalSession({
      id: "s",
      revision: 10,
      phase: "running",
      bossIndex: 2,
      playerHp: 40,
      oppHp: 25,
      chopShieldHp: 10,
      bossesDefeated: 2,
      bossesReached: 3,
      currentQuestion: { id: "q-final", type: "tf", stem: "Final?", options: undefined },
      shownAtMs: 2000,
      duelHeat: 80,
    });
    const incoming = minimalSession({
      id: "s",
      revision: 11,
      phase: "ended",
      bossIndex: 2,
      playerHp: 40,
      oppHp: 0,
      chopShieldHp: 0,
      bossesDefeated: 3,
      bossesReached: 3,
      currentQuestion: null,
      shownAtMs: null,
      duelHeat: 0,
      runScore: 999,
      answerLog: [
        {
          questionId: "q-final",
          correct: true,
          bossIndex: 2,
          latencyMs: 8,
          scoreKind: "normal",
        },
      ],
      lastBossHpDelta: -25,
    });
    const merged = mergePublicSessionForAnswerBossDefeatReveal(latest, incoming);
    expect(merged.phase).toBe("running");
    expect(merged.bossesDefeated).toBe(3);
    expect(merged.oppHp).toBe(0);
    expect(merged.chopShieldHp).toBe(0);
    expect(merged.runScore).toBe(999);
    expect(merged.currentQuestion).toEqual(latest.currentQuestion);
    expect(merged.answerLog).toEqual(incoming.answerLog);
  });
});

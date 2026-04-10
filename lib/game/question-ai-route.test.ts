import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: "session-test" }),
  }),
}));

vi.mock("@/lib/game/fs-store", () => ({
  readSessionFile: vi.fn(),
  writeSessionFileIfRevision: vi.fn(),
}));

vi.mock("@/lib/game/question-ai-validator", () => ({
  validateAiQuestion: vi.fn(() => false),
}));

import { POST } from "../../app/api/game/question-ai/route";
import { readSessionFile, writeSessionFileIfRevision } from "./fs-store";
import { oracleFeedToLiveData } from "./question-ai-service";
import type { OracleFeedSnapshot } from "./pyth-hermes-snapshot";
import { TICKER_FEED_META } from "@/lib/ticker-feed-meta";

const mockLiveData = {
  symbol: "BTC/USD",
  price: 93000,
  change24h: 0.1,
  regime: "neutral" as const,
};

describe("question-ai route behavior", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    /** Hermes is skipped when body includes liveData; only LLM calls hit fetch and should fail fast. */
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider-down")));
    vi.mocked(readSessionFile).mockResolvedValue({
      id: "session-test",
      createdAt: Date.now(),
      revision: 0,
      walletAddress: null,
      twitterHandle: null,
      displayName: null,
      avatarUrl: null,
      phase: "running",
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
      aiQuestionMix: { seed: 1, live: 1 },
      aiRecentSeedFactIds: [],
    } as any);
    vi.mocked(writeSessionFileIfRevision).mockResolvedValue(true);
  });

  it("oracleFeedToLiveData omits confidence fields for prompt chain", () => {
    const meta = TICKER_FEED_META.find((m) => m.id === 1)!;
    const feed: OracleFeedSnapshot = {
      meta,
      quizSymbol: "BTC/USD",
      price: 90000,
      confidence: 10,
      confidencePct: 0.02,
      publishTime: 1_700_000_000,
      intendedComparisonWindow: "1d",
      effectiveComparisonWindow: "1d",
      returnOverWindowPct: 1.2,
      stale: false,
    };
    const ld = oracleFeedToLiveData(feed);
    expect(ld).not.toHaveProperty("confidence");
    expect(ld).not.toHaveProperty("confidencePct");
    expect(ld.change24h).toBe(1.2);
  });

  it("uses seed-facts fallback (not bank.json) when providers fail", async () => {
    const req = new Request("http://localhost/api/game/question-ai", {
      method: "POST",
      body: JSON.stringify({ bossIndex: 0, liveData: mockLiveData }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.source).toBe("seed-facts-fallback");
    expect(json.question?.stem).not.toMatch(/oracle\s+check/i);
  });

  it("returns sourceMode and persists mix counters", async () => {
    const req = new Request("http://localhost/api/game/question-ai", {
      method: "POST",
      body: JSON.stringify({ bossIndex: 1, liveData: mockLiveData }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const json = await res.json();
    expect(["seed", "live"]).toContain(json.sourceMode);
    expect(writeSessionFileIfRevision).toHaveBeenCalled();
  });
});

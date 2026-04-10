import { describe, expect, it } from "vitest";
import type { OracleFeedSnapshot } from "./pyth-hermes-snapshot";
import { gameOracleFeedsForAi, oracleFeedToGameAiShape } from "./pyth-hermes-snapshot";
import { TICKER_FEED_META } from "@/lib/ticker-feed-meta";

function mockFeed(): OracleFeedSnapshot {
  const meta = TICKER_FEED_META.find((m) => m.id === 1)!;
  return {
    meta,
    quizSymbol: "BTC/USD",
    price: 93000,
    confidence: 12,
    confidencePct: 0.05,
    publishTime: 1_700_000_000,
    intendedComparisonWindow: "1d",
    effectiveComparisonWindow: "1d",
    returnOverWindowPct: 0.42,
    stale: false,
  };
}

describe("oracle snapshot for game AI", () => {
  it("oracleFeedToGameAiShape omits confidence fields", () => {
    const slim = oracleFeedToGameAiShape(mockFeed());
    expect(slim).not.toHaveProperty("confidence");
    expect(slim).not.toHaveProperty("confidencePct");
    expect(slim.quizSymbol).toBe("BTC/USD");
    expect(slim.price).toBe(93000);
    expect(slim.returnOverWindowPct).toBe(0.42);
  });

  it("gameOracleFeedsForAi maps all feeds without confidence keys", () => {
    const f = mockFeed();
    const out = gameOracleFeedsForAi({
      intendedComparisonWindow: "1d",
      windowLabelHuman: "the past day",
      feeds: [f],
      feedsWithReturn: [f],
    });
    expect(out).toHaveLength(1);
    const json = JSON.stringify(out[0]);
    expect(json).not.toContain("confidence");
  });
});

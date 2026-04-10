import { describe, expect, it } from "vitest";
import { chooseAiSourceMode, incrementAiMix } from "./question-ai-policy";

describe("question-ai-policy", () => {
  it("alternates on ties and balances over time", () => {
    let state = { seed: 0, live: 0 };
    for (let i = 0; i < 20; i += 1) {
      const mode = chooseAiSourceMode(state);
      state = incrementAiMix(state, mode);
    }
    expect(Math.abs(state.seed - state.live)).toBeLessThanOrEqual(1);
  });

  it("prefers the underrepresented mode", () => {
    expect(chooseAiSourceMode({ seed: 5, live: 2 })).toBe("live");
    expect(chooseAiSourceMode({ seed: 1, live: 4 })).toBe("seed");
  });
});

import { describe, it, expect } from "vitest";
import { CARD_EFFECTS, CARD_FLAVOR_LINES } from "./card-effects";

describe("CARD_FLAVOR_LINES", () => {
  it("has an entry for all 22 major arcana (0–21)", () => {
    for (let i = 0; i <= 21; i++) {
      expect(CARD_FLAVOR_LINES[i], `Missing flavor for card ${i}`).toBeDefined();
      expect(typeof CARD_FLAVOR_LINES[i]).toBe("string");
      expect(CARD_FLAVOR_LINES[i]!.length).toBeGreaterThan(0);
    }
  });

  it("contains no em-dashes", () => {
    for (const line of Object.values(CARD_FLAVOR_LINES)) {
      expect(line).not.toMatch(/\u2014/);
    }
  });

  it("CARD_EFFECTS still has all 22 entries", () => {
    for (let i = 0; i <= 21; i++) {
      expect(CARD_EFFECTS[i]).toBeDefined();
    }
  });
});

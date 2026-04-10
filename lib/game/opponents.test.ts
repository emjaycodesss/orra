import { describe, it, expect } from "vitest";
import { OPPONENTS, pickGuardianKoBanner } from "./opponents";

describe("OPPONENTS", () => {
  it("has 3 bosses", () => {
    expect(OPPONENTS).toHaveLength(3);
  });

  it("each boss has at least 5 wrong taunts and 5 correct taunts", () => {
    for (const boss of OPPONENTS) {
      expect(boss.taunts.length, `${boss.name} needs 5+ wrong taunts`).toBeGreaterThanOrEqual(5);
      expect(boss.correctTaunts.length, `${boss.name} needs 5+ correct taunts`).toBeGreaterThanOrEqual(5);
    }
  });

  it("no taunt contains an em-dash", () => {
    for (const boss of OPPONENTS) {
      for (const t of [...boss.taunts, ...boss.correctTaunts]) {
        expect(t).not.toMatch(/\u2014/);
      }
    }
  });

  it("each boss has ko banner lines and picker returns text", () => {
    for (const boss of OPPONENTS) {
      expect(boss.koBannerLines.length, `${boss.name} needs ko lines`).toBeGreaterThanOrEqual(3);
      const line = pickGuardianKoBanner(boss.displayName);
      expect(line.length).toBeGreaterThan(4);
      expect(boss.koBannerLines).toContain(line);
    }
    expect(pickGuardianKoBanner("Unknown")).toMatch(/down/i);
  });
});

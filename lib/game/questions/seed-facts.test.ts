import { describe, expect, it } from "vitest";
import {
  listSeedFactsForBoss,
  nextRecentSeedFactIds,
  pickSeedFactForBoss,
} from "./seed-facts";

describe("seed-facts utilities", () => {
  it("returns facts scoped to boss index", () => {
    const boss0 = listSeedFactsForBoss(0);
    expect(boss0.length).toBeGreaterThan(0);
    expect(boss0.every((f) => f.bossIndex === 0)).toBe(true);
  });

  it("avoids recent ids when possible", () => {
    const facts = listSeedFactsForBoss(1);
    const recent = facts.slice(0, 3).map((f) => f.id);
    const picked = pickSeedFactForBoss(1, recent);
    expect(picked).not.toBeNull();
    if (!picked) return;
    if (facts.length > recent.length) {
      expect(recent.includes(picked.id)).toBe(false);
    }
  });

  it("keeps a bounded recent id buffer", () => {
    let ids: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      ids = nextRecentSeedFactIds(ids, `id_${i}`, 8);
    }
    expect(ids.length).toBe(8);
    expect(ids[0]).toBe("id_11");
  });
});

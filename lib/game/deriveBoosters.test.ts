import { describe, expect, it } from "vitest";
import { deriveBoostersFromRandom } from "./deriveBoosters";

describe("deriveBoostersFromRandom", () => {
  it("returns three integers in 0..21", () => {
    const r =
      "0x0000000000000000000000000000000000000000000000000000000000000001" as const;
    const [a, b, c] = deriveBoostersFromRandom(r);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(21);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(21);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(21);
  });

  it("is deterministic for the same random", () => {
    const r =
      "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789" as const;
    expect(deriveBoostersFromRandom(r)).toEqual(deriveBoostersFromRandom(r));
  });
});

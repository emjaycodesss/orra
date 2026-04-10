import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  configureGameRateLimiter,
  enforceGameRateLimit,
  normalizeWalletAddress,
} from "./api-route-helpers";

describe("api-route-helpers", () => {
  beforeEach(() => {
    configureGameRateLimiter(null);
  });

  it("normalizes valid EVM addresses and rejects malformed input", () => {
    expect(normalizeWalletAddress("0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")).toBe(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    );
    expect(normalizeWalletAddress("0xzzb86991c6218b36c1d19d4a2e9eb0ce3606eb48")).toBeNull();
    expect(normalizeWalletAddress("0x1234")).toBeNull();
    expect(normalizeWalletAddress("A0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")).toBeNull();
  });

  it("uses injected limiter strategy when configured", () => {
    const limiter = { allow: vi.fn().mockReturnValue(false) };
    configureGameRateLimiter(limiter);
    const req = new Request("http://localhost/api/game/test", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    const limited = enforceGameRateLimit(req, {
      route: "game.test",
      ipMax: 1,
      sessionMax: 1,
      windowMs: 60_000,
    });
    expect(limiter.allow).toHaveBeenCalled();
    expect(limited?.status).toBe(429);
  });
});

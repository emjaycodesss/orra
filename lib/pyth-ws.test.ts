import { describe, expect, it } from "vitest";
import { pickWsUrl, PYTH_LAZER_WS_URLS } from "./pyth-ws";

describe("pyth-ws", () => {
  it("exposes a fixed set of Lazer websocket URLs", () => {
    expect(PYTH_LAZER_WS_URLS.length).toBe(3);
    expect(PYTH_LAZER_WS_URLS.every((u) => u.startsWith("wss://"))).toBe(true);
  });

  it("pickWsUrl returns one of the configured endpoints", () => {
    const url = pickWsUrl();
    expect(PYTH_LAZER_WS_URLS as readonly string[]).toContain(url);
  });
});

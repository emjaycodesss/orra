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

vi.mock("@/lib/game/leaderboard-file", () => ({
  appendLeaderboard: vi.fn(),
  loadLeaderboard: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/db/game-runs", () => ({
  insertGameRun: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../../app/api/game/leaderboard/submit/route";
import { readSessionFile } from "./fs-store";
import { appendLeaderboard, loadLeaderboard } from "./leaderboard-file";

function baseSession() {
  return {
    id: "session-test",
    createdAt: Date.now(),
    revision: 0,
    walletAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    twitterHandle: "@x",
    displayName: "X",
    avatarUrl: null,
    phase: "ended",
    answerLog: [],
    bossesDefeated: 0,
    bossesReached: 1,
    powerUpsUsed: 0,
    runScore: 100,
    lastAnswerAtMs: Date.now(),
  } as any;
}

describe("leaderboard submit route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(loadLeaderboard).mockResolvedValue([]);
  });

  it("rejects when session wallet is missing", async () => {
    vi.mocked(readSessionFile).mockResolvedValue({
      ...baseSession(),
      walletAddress: null,
    });
    const req = new Request("http://localhost/api/game/leaderboard/submit", {
      method: "POST",
      body: JSON.stringify({ walletAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe("wallet_missing_in_session");
  });

  it("rejects on wallet mismatch", async () => {
    vi.mocked(readSessionFile).mockResolvedValue(baseSession());
    const req = new Request("http://localhost/api/game/leaderboard/submit", {
      method: "POST",
      body: JSON.stringify({ walletAddress: "0x1111111111111111111111111111111111111111" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("accepts normalized wallet match", async () => {
    vi.mocked(readSessionFile).mockResolvedValue({
      ...baseSession(),
      walletAddress: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    });
    const req = new Request("http://localhost/api/game/leaderboard/submit", {
      method: "POST",
      body: JSON.stringify({ walletAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(appendLeaderboard).toHaveBeenCalled();
  });

  it("appendLeaderboard uses session id:revision when phase ended (revision 5)", async () => {
    vi.mocked(readSessionFile).mockResolvedValue({
      ...baseSession(),
      revision: 5,
    });
    const req = new Request("http://localhost/api/game/leaderboard/submit", {
      method: "POST",
      body: JSON.stringify({ walletAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(appendLeaderboard).toHaveBeenCalledTimes(1);
    expect(appendLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-test:5", score: 100 }),
    );
  });

  it("same session id with revision 6 and higher runScore submits again with session-test:6", async () => {
    vi.mocked(readSessionFile).mockResolvedValue({
      ...baseSession(),
      revision: 6,
      runScore: 250,
    });
    vi.mocked(loadLeaderboard).mockResolvedValue([
      { id: "session-test:5" } as any,
    ]);
    const req = new Request("http://localhost/api/game/leaderboard/submit", {
      method: "POST",
      body: JSON.stringify({ walletAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(appendLeaderboard).toHaveBeenCalledTimes(1);
    expect(appendLeaderboard).toHaveBeenCalledWith(
      expect.objectContaining({ id: "session-test:6", score: 250 }),
    );
  });
});

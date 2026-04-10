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

vi.mock("@/lib/db/game-runs", () => ({
  getRunsByWallet: vi.fn().mockResolvedValue([]),
}));

import { GET } from "../../app/api/game/runs/route";
import { readSessionFile } from "./fs-store";
import { getRunsByWallet } from "../db/game-runs";

describe("runs route hybrid access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(readSessionFile).mockResolvedValue({
      id: "session-test",
      walletAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      phase: "running",
    } as any);
  });

  it("rejects wallet mismatch", async () => {
    const req = new Request("http://localhost/api/game/runs?wallet=0x1111111111111111111111111111111111111111");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns owner runs when wallet omitted", async () => {
    const req = new Request("http://localhost/api/game/runs");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(getRunsByWallet).toHaveBeenCalledWith(
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      20,
    );
  });
});

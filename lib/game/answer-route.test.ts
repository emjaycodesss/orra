import { NextResponse } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../../app/api/game/answer/route";
import type { GameSession } from "@/lib/game/types";

vi.mock("@/lib/game/api-route-helpers", () => ({
  requireGameSession: vi.fn(),
  parseJsonBody: vi.fn(),
}));

vi.mock("@/lib/game/engine", () => ({
  submitAnswer: vi.fn(),
}));

vi.mock("@/lib/game/fs-store", () => ({
  writeSessionFileIfRevision: vi.fn(),
  readSessionFile: vi.fn(),
}));

vi.mock("@/lib/game/http-session", () => ({
  stripSecretAnswers: vi.fn((session: unknown) => session),
}));

describe("answer route timing", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns Server-Timing phases on successful answer submit", async () => {
    const helpers = await import("@/lib/game/api-route-helpers");
    const engine = await import("@/lib/game/engine");
    const store = await import("@/lib/game/fs-store");

    const currentSession = {
      revision: 1,
      currentQuestion: { id: "q-1", type: "tf" },
      lastAnswer: null,
    };
    const nextSession = {
      ...currentSession,
      revision: 2,
      lastAnswer: { questionId: "q-1" },
    };

    vi.mocked(helpers.requireGameSession).mockResolvedValue({
      sessionId: "session-1",
      session: currentSession as unknown as GameSession,
    });
    vi.mocked(helpers.parseJsonBody).mockResolvedValue({
      questionId: "q-1",
      submitId: "submit-1",
      boolChoice: true,
    });
    vi.mocked(engine.submitAnswer).mockReturnValue(nextSession as never);
    vi.mocked(store.writeSessionFileIfRevision).mockResolvedValue(true);

    const response = await POST(
      new Request("http://localhost/api/game/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: "q-1", submitId: "submit-1", boolChoice: true }),
      }),
    );

    expect(response.status).toBe(200);
    const serverTiming = response.headers.get("server-timing");
    expect(serverTiming).toContain("parse;dur=");
    expect(serverTiming).toContain("compute;dur=");
    expect(serverTiming).toContain("write;dur=");
    expect(serverTiming).toContain("total;dur=");
  });

  it("returns Server-Timing on early session failure with parse and total durations set", async () => {
    const helpers = await import("@/lib/game/api-route-helpers");
    let tick = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => {
      tick += 12;
      return tick;
    });
    vi.mocked(helpers.requireGameSession).mockResolvedValue(
      NextResponse.json({ error: "no_session" }, { status: 401 }),
    );

    try {
      const response = await POST(
        new Request("http://localhost/api/game/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      );

      expect(response.status).toBe(401);
      const serverTiming = response.headers.get("server-timing");
      expect(serverTiming).toBeTruthy();
      expect(serverTiming).toContain("parse;dur=");
      expect(serverTiming).toContain("total;dur=");
      const parseDur = Number(serverTiming!.match(/parse;dur=([\d.]+)/)?.[1]);
      const totalDur = Number(serverTiming!.match(/total;dur=([\d.]+)/)?.[1]);
      expect(Number.isFinite(parseDur)).toBe(true);
      expect(Number.isFinite(totalDur)).toBe(true);
      expect(parseDur).toBeGreaterThan(0);
      expect(totalDur).toBeGreaterThan(0);
    } finally {
      nowSpy.mockRestore();
    }
  });
});

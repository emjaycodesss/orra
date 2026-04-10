import { describe, expect, it, vi } from "vitest";
import { GET as debugTweetiqGet } from "../../app/api/game/debug-tweetiq/route";
import { POST as debugDbPost } from "../../app/api/game/debug-db/route";

describe("debug routes", () => {
  it("returns not_found outside development for tweetiq", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await debugTweetiqGet(new Request("http://localhost/api/game/debug-tweetiq?username=test"));
    expect(res.status).toBe(404);
    vi.unstubAllEnvs();
  });

  it("returns not_found outside development for db debug", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await debugDbPost(
      new Request("http://localhost/api/game/debug-db", {
        method: "POST",
        body: JSON.stringify({ session_id: "s" }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.status).toBe(404);
    vi.unstubAllEnvs();
  });
});

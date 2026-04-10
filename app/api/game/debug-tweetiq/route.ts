import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-observability";

const TWEETIQ = "https://tweetiq.onrender.com/api/analyze/profile";

/**
 * Debug endpoint to test tweetiq connectivity and response.
 * Only available in development.
 * GET /api/game/debug-tweetiq?username=elonmusk
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const username = url.searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "username query param required" }, { status: 400 });
  }

  const raw = username.trim().replace(/^@+/, "");
  if (!raw || raw.length > 32 || !/^[A-Za-z0-9_]+$/.test(raw)) {
    return NextResponse.json({ error: "invalid username format" }, { status: 400 });
  }

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 12_000);

    const res = await fetch(TWEETIQ, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: raw }),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `tweetiq returned ${res.status}`,
          status: res.status,
          statusText: res.statusText,
        },
        { status: res.status }
      );
    }

    const data = (await res.json()) as Record<string, unknown>;

    return NextResponse.json({
      username: raw,
      success: true,
      rawResponse: data,
      parsed: {
        name:
          (typeof data.name === "string" && data.name) ||
          (typeof data.displayName === "string" && data.displayName) ||
          (typeof data.username === "string" && data.username) ||
          null,
        pic:
          (typeof data.profile_image_url_https === "string" && data.profile_image_url_https) ||
          (typeof data.profile_image_url === "string" && data.profile_image_url) ||
          (typeof data.profileImageUrl === "string" && data.profileImageUrl) ||
          (typeof data.avatar === "string" && data.avatar) ||
          null,
      },
    });
  } catch (err) {
    logApiError("api/game/debug-tweetiq", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        type: err instanceof TypeError ? "network_error" : "unknown_error",
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

const TWEETIQ = "https://tweetiq.onrender.com/api/analyze/profile";

export async function POST(req: Request) {
  let body: { username?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = (body.username ?? "").trim().replace(/^@+/, "");
  if (!raw || raw.length > 32 || !/^[A-Za-z0-9_]+$/.test(raw)) {
    return NextResponse.json({ error: "username" }, { status: 400 });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(TWEETIQ, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: raw }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      return NextResponse.json({
        fallback: true,
        handle: `@${raw}`,
        displayName: `@${raw}`,
        avatarUrl: null as string | null,
      });
    }
    const j = (await res.json()) as Record<string, unknown>;
    const name =
      (typeof j.name === "string" && j.name) ||
      (typeof j.displayName === "string" && j.displayName) ||
      `@${raw}`;
    const pic =
      (typeof j.profile_image_url === "string" && j.profile_image_url) ||
      (typeof j.profileImageUrl === "string" && j.profileImageUrl) ||
      (typeof j.avatar === "string" && j.avatar) ||
      null;
    return NextResponse.json({
      fallback: false,
      handle: `@${raw}`,
      displayName: String(name),
      avatarUrl: pic,
    });
  } catch {
    return NextResponse.json({
      fallback: true,
      handle: `@${raw}`,
      displayName: `@${raw}`,
      avatarUrl: null as string | null,
    });
  }
}

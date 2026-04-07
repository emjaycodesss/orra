import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionFile, writeSessionFile } from "@/lib/game/fs-store";
import { GAME_SESSION_COOKIE, stripSecretAnswers } from "@/lib/game/http-session";

const TWEETIQ = "https://tweetiq.onrender.com/api/analyze/profile";

export async function POST(req: Request) {
  const jar = await cookies();
  const id = jar.get(GAME_SESSION_COOKIE)?.value;
  if (!id) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }
  const session = await readSessionFile(id);
  if (!session) {
    return NextResponse.json({ error: "expired" }, { status: 401 });
  }

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

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
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
    if (res.ok) {
      const j = (await res.json()) as Record<string, unknown>;
      const name =
        (typeof j.name === "string" && j.name) ||
        (typeof j.displayName === "string" && j.displayName) ||
        (typeof j.username === "string" && j.username);
      const pic =
        (typeof j.profile_image_url === "string" && j.profile_image_url) ||
        (typeof j.profileImageUrl === "string" && j.profileImageUrl) ||
        (typeof j.avatar === "string" && j.avatar);
      displayName = name ? String(name) : `@${raw}`;
      avatarUrl = pic ? String(pic) : null;
    }
  } catch {
    /* fallback below */
  }

  const next = {
    ...session,
    twitterHandle: `@${raw}`,
    displayName: displayName ?? `@${raw}`,
    avatarUrl,
  };
  await writeSessionFile(id, next);
  return NextResponse.json({ session: stripSecretAnswers(next), fallback: !avatarUrl });
}

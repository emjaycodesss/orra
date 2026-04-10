import { NextResponse } from "next/server";
import { createLobbySession } from "@/lib/game/engine";
import { newSessionId, writeSessionFile } from "@/lib/game/fs-store";
import { GAME_SESSION_COOKIE } from "@/lib/game/http-session";

export async function POST() {
  const id = newSessionId();
  try {
    const session = createLobbySession(id);
    await writeSessionFile(id, session);
  } catch (err) {
    const exposeDetails = process.env.NODE_ENV === "development";
    return NextResponse.json(
      exposeDetails
        ? { error: "exit_session_creation_failed", details: err instanceof Error ? err.message : String(err) }
        : { error: "exit_session_creation_failed" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ ok: true, sessionId: id });
  res.cookies.set(GAME_SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return res;
}

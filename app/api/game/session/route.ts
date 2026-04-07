import { NextResponse } from "next/server";
import { createLobbySession } from "@/lib/game/engine";
import { newSessionId, writeSessionFile } from "@/lib/game/fs-store";
import { GAME_SESSION_COOKIE } from "@/lib/game/http-session";

export async function POST() {
  const id = newSessionId();
  const session = createLobbySession(id);
  await writeSessionFile(id, session);
  const res = NextResponse.json({ sessionId: id });
  res.cookies.set(GAME_SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return res;
}

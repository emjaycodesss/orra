import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createLobbySession } from "@/lib/game/engine";
import { newSessionId, readSessionFile, writeSessionFile } from "@/lib/game/fs-store";
import { GAME_SESSION_COOKIE, stripSecretAnswers } from "@/lib/game/http-session";

const ACTIVE_SESSION_STALE_MS = 30 * 60 * 1000; // 30 minutes

function isStaleActiveSession(session: Awaited<ReturnType<typeof readSessionFile>>): boolean {
  if (!session) return false;
  if (session.phase !== "running" && session.phase !== "ended") return false;
  const lastTouched = Math.max(
    session.createdAt ?? 0,
    session.lastAnswerAtMs ?? 0,
    session.lastPowerUpFeedbackAtMs ?? 0,
    session.shownAtMs ?? 0,
  );
  return Date.now() - lastTouched > ACTIVE_SESSION_STALE_MS;
}

export async function GET() {
  const jar = await cookies();
  const id = jar.get(GAME_SESSION_COOKIE)?.value;
  if (!id) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }
  try {
    const session = await readSessionFile(id);
    if (!session) {
      return NextResponse.json({ error: "expired" }, { status: 401 });
    }
    if (isStaleActiveSession(session)) {
      const freshId = newSessionId();
      const fresh = createLobbySession(freshId);
      await writeSessionFile(freshId, fresh);
      const res = NextResponse.json({
        session: stripSecretAnswers(fresh),
        recoveredFromStaleSession: true,
      });
      res.cookies.set(GAME_SESSION_COOKIE, freshId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 4,
      });
      return res;
    }
    return NextResponse.json({ session: stripSecretAnswers(session) });
  } catch (err) {
    const exposeDetails = process.env.NODE_ENV === "development";
    return NextResponse.json(
      exposeDetails
        ? { error: "session_read_failed", details: err instanceof Error ? err.message : String(err) }
        : { error: "session_read_failed" },
      { status: 500 }
    );
  }
}

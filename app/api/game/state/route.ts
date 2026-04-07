import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSessionFile } from "@/lib/game/fs-store";
import { GAME_SESSION_COOKIE, stripSecretAnswers } from "@/lib/game/http-session";

export async function GET() {
  const jar = await cookies();
  const id = jar.get(GAME_SESSION_COOKIE)?.value;
  if (!id) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }
  const session = await readSessionFile(id);
  if (!session) {
    return NextResponse.json({ error: "expired" }, { status: 401 });
  }
  return NextResponse.json({ session: stripSecretAnswers(session) });
}

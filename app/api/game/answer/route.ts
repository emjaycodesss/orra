import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { submitAnswer } from "@/lib/game/engine";
import { readSessionFile, writeSessionFile } from "@/lib/game/fs-store";
import { GAME_SESSION_COOKIE, stripSecretAnswers } from "@/lib/game/http-session";

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

  let body: { boolChoice?: boolean; choiceIndex?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const next = submitAnswer(session, body.boolChoice, body.choiceIndex);
  await writeSessionFile(id, next);
  return NextResponse.json({ session: stripSecretAnswers(next) });
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { applyPowerUp } from "@/lib/game/engine";
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

  let body: { slot?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const slot = body.slot;
  if (slot !== 0 && slot !== 1 && slot !== 2) {
    return NextResponse.json({ error: "slot" }, { status: 400 });
  }

  const next = applyPowerUp(session, slot);
  await writeSessionFile(id, next);
  return NextResponse.json({ session: stripSecretAnswers(next) });
}

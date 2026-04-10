import { NextResponse } from "next/server";
import { applyPowerUp } from "@/lib/game/engine";
import { readSessionFile, writeSessionFileIfRevision } from "@/lib/game/fs-store";
import { stripSecretAnswers } from "@/lib/game/http-session";
import { parseJsonBody, requireGameSession } from "@/lib/game/api-route-helpers";

/** Apply arcana from `slot` (0–2). Judgement (XX) is passive — rejects with `passive_card` (matches engine). */
export async function POST(req: Request) {
  const sessionResult = await requireGameSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const { sessionId: id, session } = sessionResult;

  const parsed = await parseJsonBody<{ slot?: number }>(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed;
  const slot = body.slot;
  if (slot !== 0 && slot !== 1 && slot !== 2) {
    return NextResponse.json({ error: "slot" }, { status: 400 });
  }

  const selected = session.boosters[slot];
  if (!selected) {
    return NextResponse.json({ error: "slot" }, { status: 400 });
  }
  if (selected.majorIndex === 20) {
    return NextResponse.json({ error: "passive_card" }, { status: 400 });
  }

  const maxAttempts = 3;
  let current = session;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const expectedRevision = current.revision ?? 0;
    const next = applyPowerUp(current, slot);
    const wrote = await writeSessionFileIfRevision(id, next, expectedRevision);
    if (wrote) {
      return NextResponse.json({ session: stripSecretAnswers(next) });
    }
    const refreshed = await readSessionFile(id);
    if (!refreshed) return NextResponse.json({ error: "expired" }, { status: 401 });
    current = refreshed;
  }

  return NextResponse.json({ error: "write_conflict" }, { status: 409 });
}

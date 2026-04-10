import { NextResponse } from "next/server";
import { applyDuelCombo } from "@/lib/game/engine";
import { readSessionFile, writeSessionFileIfRevision } from "@/lib/game/fs-store";
import { stripSecretAnswers } from "@/lib/game/http-session";
import { parseJsonBody, requireGameSession } from "@/lib/game/api-route-helpers";
import { DUEL_HEAT_MAX } from "@/lib/game/duel-heat";

/**
 * Server-authoritative combo damage HP.
 * Legacy `comboDamageHp` in the body is parsed for wire compatibility and ignored for gameplay.
 */
const SERVER_COMBO_DAMAGE_HP = 35;

export async function POST(req: Request) {
  const sessionResult = await requireGameSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const { sessionId: id, session } = sessionResult;

  const parsed = await parseJsonBody<Record<string, unknown>>(req);
  if (parsed instanceof NextResponse) return parsed;
  const comboDamageRaw = parsed.comboDamageHp;
  const legacyClientComboDamageHp =
    typeof comboDamageRaw === "number" && Number.isFinite(comboDamageRaw)
      ? Math.max(0, Math.floor(comboDamageRaw))
      : SERVER_COMBO_DAMAGE_HP;
  void legacyClientComboDamageHp;

  const maxAttempts = 3;
  let current = session;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const duelHeat = current.duelHeat ?? 0;
    const isEligible =
      current.phase === "running" &&
      current.playerHp > 0 &&
      current.oppHp > 0 &&
      duelHeat >= DUEL_HEAT_MAX;
    if (!isEligible) {
      return NextResponse.json({ error: "not_available" }, { status: 400 });
    }

    const expectedRevision = current.revision ?? 0;
    const next = applyDuelCombo(current, SERVER_COMBO_DAMAGE_HP);
    const wrote = await writeSessionFileIfRevision(id, next, expectedRevision);
    if (wrote) {
      return NextResponse.json({ session: stripSecretAnswers(next) });
    }
    const refreshed = await readSessionFile(id);
    if (!refreshed) {
      return NextResponse.json({ error: "expired" }, { status: 401 });
    }
    current = refreshed;
  }

  return NextResponse.json({ error: "write_conflict" }, { status: 409 });
}

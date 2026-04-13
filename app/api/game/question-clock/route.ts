import { NextResponse } from "next/server";
import { startQuestionClockIfDeferred } from "@/lib/game/engine";
import { readSessionFile, writeSessionFileIfRevision } from "@/lib/game/fs-store";
import { stripSecretAnswers } from "@/lib/game/http-session";
import { parseJsonBody, requireGameSession } from "@/lib/game/api-route-helpers";
import type { GameSession } from "@/lib/game/types";

function validateQuestionClock(s: GameSession, questionId: string): NextResponse | null {
  if (s.phase !== "running" || !s.currentQuestion) {
    return NextResponse.json({ error: "no_active_question" }, { status: 400 });
  }
  if (s.currentQuestion.id !== questionId) {
    return NextResponse.json({ error: "stale_question" }, { status: 409 });
  }
  return null;
}

/**
 * Client calls this when the first question of a guardian segment is visible (boss-intro finished).
 * Stamps `shownAtMs` so latency grading and HUD anchor match the full 30s budget.
 */
export async function POST(req: Request) {
  const sessionResult = await requireGameSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const { sessionId: id, session: initial } = sessionResult;

  const parsed = await parseJsonBody<{ questionId?: string }>(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed;

  if (!body.questionId || typeof body.questionId !== "string") {
    return NextResponse.json({ error: "question_id_required" }, { status: 400 });
  }

  const bad = validateQuestionClock(initial, body.questionId);
  if (bad) return bad;

  const maxAttempts = 3;
  let current = initial;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const expectedRevision = current.revision ?? 0;
    const next = startQuestionClockIfDeferred(current);
    if (next === current) {
      return NextResponse.json({ session: stripSecretAnswers(current) });
    }
    const wrote = await writeSessionFileIfRevision(id, next, expectedRevision);
    if (wrote) {
      return NextResponse.json({ session: stripSecretAnswers(next) });
    }
    const refreshed = await readSessionFile(id);
    if (!refreshed) return NextResponse.json({ error: "expired" }, { status: 401 });
    const again = validateQuestionClock(refreshed, body.questionId);
    if (again) return again;
    current = refreshed;
  }

  return NextResponse.json({ error: "write_conflict" }, { status: 409 });
}

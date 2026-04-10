import { NextResponse } from "next/server";
import { submitAnswer } from "@/lib/game/engine";
import { readSessionFile, writeSessionFileIfRevision } from "@/lib/game/fs-store";
import { stripSecretAnswers } from "@/lib/game/http-session";
import { parseJsonBody, requireGameSession } from "@/lib/game/api-route-helpers";

/**
 * Grade an answer; sets Server-Timing (`parse` includes session resolution so auth failures are not `0ms`).
 * Stale `questionId` with matching `lastAnswer` returns `duplicate: true` (post-submit race).
 */
export async function POST(req: Request) {
  const requestStartedAt = performance.now();
  let parseMs = 0;
  let computeMs = 0;
  let writeMs = 0;

  const formatDuration = (value: number) => Math.max(0, value).toFixed(1);
  const withTiming = (res: NextResponse) => {
    const totalMs = performance.now() - requestStartedAt;
    res.headers.set(
      "Server-Timing",
      [
        `parse;dur=${formatDuration(parseMs)}`,
        `compute;dur=${formatDuration(computeMs)}`,
        `write;dur=${formatDuration(writeMs)}`,
        `total;dur=${formatDuration(totalMs)}`,
      ].join(", "),
    );
    return res;
  };

  const sessionResult = await requireGameSession();
  if (sessionResult instanceof NextResponse) {
    parseMs = performance.now() - requestStartedAt;
    return withTiming(sessionResult);
  }
  const { sessionId: id, session } = sessionResult;

  const parsed = await parseJsonBody<{
    questionId?: string;
    submitId?: string;
    boolChoice?: boolean;
    choiceIndex?: number;
  }>(req);
  if (parsed instanceof NextResponse) {
    parseMs = performance.now() - requestStartedAt;
    return withTiming(parsed);
  }
  const body = parsed;

  if (!body.questionId || typeof body.questionId !== "string") {
    parseMs = performance.now() - requestStartedAt;
    return withTiming(NextResponse.json({ error: "question_id_required" }, { status: 400 }));
  }
  if (!body.submitId || typeof body.submitId !== "string") {
    parseMs = performance.now() - requestStartedAt;
    return withTiming(NextResponse.json({ error: "submit_id_required" }, { status: 400 }));
  }

  const currentQuestion = session.currentQuestion;
  if (!currentQuestion || currentQuestion.id !== body.questionId) {
    if (session.lastAnswer?.questionId === body.questionId) {
      parseMs = performance.now() - requestStartedAt;
      return withTiming(
        NextResponse.json({ session: stripSecretAnswers(session), duplicate: true }),
      );
    }
    parseMs = performance.now() - requestStartedAt;
    return withTiming(NextResponse.json({ error: "stale_question" }, { status: 409 }));
  }
  if (currentQuestion.type === "tf") {
    const validBool = typeof body.boolChoice === "boolean" || body.boolChoice === undefined;
    if (!validBool || body.choiceIndex !== undefined) {
      parseMs = performance.now() - requestStartedAt;
      return withTiming(NextResponse.json({ error: "invalid_tf_payload" }, { status: 400 }));
    }
  } else {
    const validChoice =
      typeof body.choiceIndex === "number" &&
      Number.isInteger(body.choiceIndex) &&
      body.choiceIndex >= -1;
    if (!validChoice || body.boolChoice !== undefined) {
      parseMs = performance.now() - requestStartedAt;
      return withTiming(NextResponse.json({ error: "invalid_mcq_payload" }, { status: 400 }));
    }
  }
  parseMs = performance.now() - requestStartedAt;

  const maxAttempts = 3;
  let current = session;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const expectedRevision = current.revision ?? 0;
    const computeStartedAt = performance.now();
    const next = submitAnswer(current, body.boolChoice, body.choiceIndex);
    computeMs += performance.now() - computeStartedAt;

    const writeStartedAt = performance.now();
    const wrote = await writeSessionFileIfRevision(id, next, expectedRevision);
    writeMs += performance.now() - writeStartedAt;
    if (wrote) {
      return withTiming(NextResponse.json({ session: stripSecretAnswers(next) }));
    }
    const refreshStartedAt = performance.now();
    const refreshed = await readSessionFile(id);
    writeMs += performance.now() - refreshStartedAt;
    if (!refreshed) {
      return withTiming(NextResponse.json({ error: "expired" }, { status: 401 }));
    }
    if (refreshed.lastAnswer?.questionId === body.questionId) {
      return withTiming(
        NextResponse.json({ session: stripSecretAnswers(refreshed), duplicate: true }),
      );
    }
    current = refreshed;
  }

  return withTiming(NextResponse.json({ error: "write_conflict" }, { status: 409 }));
}

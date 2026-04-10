import { NextResponse } from "next/server";
import { startRun } from "@/lib/game/engine";
import { readSessionFile, writeSessionFileIfRevision } from "@/lib/game/fs-store";
import { stripSecretAnswers } from "@/lib/game/http-session";
import { parseJsonBody, requireGameSession } from "@/lib/game/api-route-helpers";

export async function POST(req: Request) {
  const sessionResult = await requireGameSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const { sessionId: id, session: initialSession } = sessionResult;

  const xHandle = initialSession.twitterHandle?.replace(/^@+/, "").trim();
  const devMock = process.env.ORRA_TRIVIA_DEV_MOCK === "1";
  if (!xHandle && !devMock) {
    return NextResponse.json({ error: "twitter_required" }, { status: 400 });
  }

  const parsed = await parseJsonBody<{ walletAddress?: string; boosterIndices?: number[] }>(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed;

  const boosters = body.boosterIndices;
  if (!Array.isArray(boosters) || boosters.length !== 3) {
    return NextResponse.json({ error: "boosters" }, { status: 400 });
  }
  for (const x of boosters) {
    if (typeof x !== "number" || x < 0 || x > 21 || !Number.isInteger(x)) {
      return NextResponse.json({ error: "boosters_range" }, { status: 400 });
    }
  }

  let current = initialSession;
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (current.phase === "running") {
      return NextResponse.json({ session: stripSecretAnswers(current), duplicate: true });
    }
    let next = {
      ...current,
      walletAddress:
        typeof body.walletAddress === "string" && body.walletAddress.startsWith("0x")
          ? body.walletAddress
          : current.walletAddress,
    };
    next = startRun(next, boosters);

    const expectedRevision = current.revision ?? 0;
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

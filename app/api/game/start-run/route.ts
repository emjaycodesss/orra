import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { startRun } from "@/lib/game/engine";
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

  const xHandle = session.twitterHandle?.replace(/^@+/, "").trim();
  if (!xHandle) {
    return NextResponse.json({ error: "twitter_required" }, { status: 400 });
  }

  let body: { walletAddress?: string; boosterIndices?: number[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const boosters = body.boosterIndices;
  if (!Array.isArray(boosters) || boosters.length !== 3) {
    return NextResponse.json({ error: "boosters" }, { status: 400 });
  }
  for (const x of boosters) {
    if (typeof x !== "number" || x < 0 || x > 21 || !Number.isInteger(x)) {
      return NextResponse.json({ error: "boosters_range" }, { status: 400 });
    }
  }

  let next = {
    ...session,
    walletAddress:
      typeof body.walletAddress === "string" && body.walletAddress.startsWith("0x")
        ? body.walletAddress
        : session.walletAddress,
  };
  next = startRun(next, boosters);
  await writeSessionFile(id, next);
  return NextResponse.json({ session: stripSecretAnswers(next) });
}

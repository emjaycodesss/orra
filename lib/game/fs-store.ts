import { mkdir, readFile, writeFile, rename } from "fs/promises";
import path from "path";
import { isGameDatabaseEnabled } from "@/lib/db/env";
import {
  readSessionFromDb,
  writeSessionToDb,
  writeSessionToDbIfRevision,
} from "@/lib/game/game-db-sessions";
import type { GameSession } from "./types";
import { devWarn } from "@/lib/dev-warn";

const DIR = path.join(process.cwd(), ".data", "orra-game");

async function ensureDir() {
  await mkdir(DIR, { recursive: true });
}

/**
 * We only fall back when the DB is configured but unreachable (DNS/network).
 * This keeps the RLS-backed DB path as the primary store when it works.
 * Recognizes common pg/libpq signals: ENOTFOUND, EAI_AGAIN, ECONNREFUSED, ETIMEDOUT, EHOSTUNREACH.
 */
function shouldFallbackToFsFromDbError(err: unknown): boolean {
  if (process.env.NODE_ENV === "production") return false;

  const e = err as { code?: unknown; message?: unknown };
  const code = typeof e.code === "string" ? e.code : undefined;
  const msg = typeof e.message === "string" ? e.message : undefined;
  const haystack = `${code ?? ""} ${msg ?? ""}`.toUpperCase();

  return (
    haystack.includes("ENOTFOUND") ||
    haystack.includes("EAI_AGAIN") ||
    haystack.includes("ECONNREFUSED") ||
    haystack.includes("ETIMEDOUT") ||
    haystack.includes("EHOSTUNREACH")
  );
}

async function readSessionFromFs(id: string): Promise<GameSession | null> {
  try {
    const raw = await readFile(path.join(DIR, `${id}.json`), "utf8");
    const parsed = JSON.parse(raw) as GameSession;
    return {
      ...parsed,
      revision: Number.isFinite(parsed.revision) ? parsed.revision : 0,
      duelHeat: typeof parsed.duelHeat === "number" ? parsed.duelHeat : 0,
      lastPowerUpFeedbackAtMs:
        typeof parsed.lastPowerUpFeedbackAtMs === "number"
          ? parsed.lastPowerUpFeedbackAtMs
          : null,
    };
  } catch {
    return null;
  }
}

async function writeSessionToFs(id: string, session: GameSession): Promise<void> {
  await ensureDir();
  const p = path.join(DIR, `${id}.json`);
  const tmp = `${p}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(session), "utf8");
  await rename(tmp, p);
}

export async function readSessionFile(id: string): Promise<GameSession | null> {
  if (isGameDatabaseEnabled()) {
    try {
      return await readSessionFromDb(id);
    } catch (e) {
      if (!shouldFallbackToFsFromDbError(e)) throw e;
      devWarn("db-fallback-read-session", e);
      return readSessionFromFs(id);
    }
  }
  return readSessionFromFs(id);
}

export async function writeSessionFile(id: string, session: GameSession): Promise<void> {
  const normalized: GameSession = {
    ...session,
    revision: Number.isFinite(session.revision) ? session.revision : 0,
  };
  if (isGameDatabaseEnabled()) {
    try {
      await writeSessionToDb(id, normalized);
      return;
    } catch (e) {
      if (!shouldFallbackToFsFromDbError(e)) throw e;
      devWarn("db-fallback-write-session", e);
      await writeSessionToFs(id, normalized);
      return;
    }
  }
  await writeSessionToFs(id, normalized);
}

export async function writeSessionFileIfRevision(
  id: string,
  session: GameSession,
  expectedRevision: number,
): Promise<boolean> {
  const next: GameSession = {
    ...session,
    revision: expectedRevision + 1,
  };
  if (isGameDatabaseEnabled()) {
    try {
      return await writeSessionToDbIfRevision(id, next, expectedRevision);
    } catch (e) {
      if (!shouldFallbackToFsFromDbError(e)) throw e;
      devWarn("db-fallback-cas-write-session", e);
    }
  }

  const latest = await readSessionFromFs(id);
  const currentRevision = latest?.revision ?? 0;
  if (currentRevision !== expectedRevision) return false;
  await writeSessionToFs(id, next);
  return true;
}

export function newSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

import { mkdir, readFile, writeFile, rename } from "fs/promises";
import path from "path";
import { isGameDatabaseEnabled } from "@/lib/db/env";
import { appendLeaderboardToDb, loadLeaderboardFromDb } from "@/lib/game/game-db-leaderboard";
import type { LeaderboardRow } from "@/lib/game/leaderboard-types";
import { devWarn } from "@/lib/dev-warn";

export type { LeaderboardRow } from "@/lib/game/leaderboard-types";

const DIR = path.join(process.cwd(), ".data", "orra-game");
const FILE = path.join(DIR, "leaderboard.json");

async function ensureDir() {
  await mkdir(DIR, { recursive: true });
}

/**
 * Dev-only fallback when Postgres host/network is unreachable.
 * Keeps local iteration unblocked when Supabase DNS or connectivity is down.
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

async function loadLeaderboardFromFs(): Promise<LeaderboardRow[]> {
  try {
    const raw = await readFile(FILE, "utf8");
    const data = JSON.parse(raw) as LeaderboardRow[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function appendLeaderboardToFs(row: LeaderboardRow): Promise<void> {
  const rows = await loadLeaderboardFromFs();
  rows.push(row);
  const trimmed = rows.slice(-2000);
  await ensureDir();
  const tmp = `${FILE}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(trimmed), "utf8");
  await rename(tmp, FILE);
}

export async function loadLeaderboard(): Promise<LeaderboardRow[]> {
  if (isGameDatabaseEnabled()) {
    try {
      return await loadLeaderboardFromDb();
    } catch (e) {
      if (!shouldFallbackToFsFromDbError(e)) throw e;
      devWarn("db-fallback-load-leaderboard", e);
      return loadLeaderboardFromFs();
    }
  }
  return loadLeaderboardFromFs();
}

export async function appendLeaderboard(row: LeaderboardRow): Promise<void> {
  if (isGameDatabaseEnabled()) {
    try {
      await appendLeaderboardToDb(row);
      return;
    } catch (e) {
      if (!shouldFallbackToFsFromDbError(e)) throw e;
      devWarn("db-fallback-append-leaderboard", e);
      await appendLeaderboardToFs(row);
      return;
    }
  }
  await appendLeaderboardToFs(row);
}

export function leaderboardStats(rows: LeaderboardRow[]): {
  meanScore: number;
  submissionCount: number;
  medianScore: number;
} {
  const scores = rows.map((r) => r.score).sort((a, b) => a - b);
  const n = scores.length;
  if (n === 0) return { meanScore: 0, submissionCount: 0, medianScore: 0 };
  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const mid = Math.floor(n / 2);
  const median = n % 2 === 1 ? scores[mid]! : (scores[mid - 1]! + scores[mid]!) / 2;
  return { meanScore: mean, submissionCount: n, medianScore: median };
}

export function percentileBelow(score: number, rows: LeaderboardRow[]): number {
  if (rows.length === 0) return 0;
  const below = rows.filter((r) => r.score < score).length;
  return Math.round((100 * below) / rows.length);
}

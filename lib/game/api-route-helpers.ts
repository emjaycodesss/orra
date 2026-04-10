import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-observability";
import { GAME_SESSION_COOKIE } from "@/lib/game/http-session";
import { readSessionFile, writeSessionFileIfRevision } from "@/lib/game/fs-store";
import type { GameSession } from "@/lib/game/types";

type RateLimitBucket = { count: number; resetAtMs: number };
const RATE_LIMIT_BUCKETS = new Map<string, RateLimitBucket>();
const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

/**
 * Pluggable limiter strategy so production can use durable storage while local/dev
 * can keep lightweight in-memory counters.
 */
interface GameRateLimiter {
  allow(key: string, max: number, windowMs: number): boolean;
}

const inMemoryRateLimiter: GameRateLimiter = {
  allow(key, max, windowMs) {
    const now = Date.now();
    const bucket = RATE_LIMIT_BUCKETS.get(key);
    if (!bucket || now >= bucket.resetAtMs) {
      RATE_LIMIT_BUCKETS.set(key, { count: 1, resetAtMs: now + windowMs });
      return true;
    }
    if (bucket.count >= max) return false;
    bucket.count += 1;
    return true;
  },
};

let activeRateLimiter: GameRateLimiter = inMemoryRateLimiter;
let warnedAboutInMemoryLimiter = false;

/**
 * Builds a consistent JSON API error payload.
 * Optional `message` is safe for UI (machine code stays in `error`).
 */
export function jsonApiError(
  error: string,
  status: number,
  opts?: { message?: string },
): NextResponse {
  const body: { error: string; message?: string } = { error };
  if (opts?.message) body.message = opts.message;
  return NextResponse.json(body, { status });
}

/** Client IP: first hop from `X-Forwarded-For` when present, else `X-Real-IP`. */
function clientIpFromRequest(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const xr = req.headers.get("x-real-ip")?.trim();
  if (xr) return xr;
  return "unknown";
}

/**
 * Replaces the default in-memory limiter with a durable implementation when available.
 */
export function configureGameRateLimiter(limiter: GameRateLimiter | null): void {
  activeRateLimiter = limiter ?? inMemoryRateLimiter;
  warnedAboutInMemoryLimiter = false;
}

function maybeWarnInMemoryLimiter(route: string): void {
  if (warnedAboutInMemoryLimiter) return;
  if (activeRateLimiter !== inMemoryRateLimiter) return;
  if (process.env.NODE_ENV !== "production") return;
  warnedAboutInMemoryLimiter = true;
  logApiError("api/game/rate-limit", new Error("in_memory_rate_limiter_active"), { route });
}

/**
 * Best-effort in-memory rate limiting for expensive routes.
 * This is intentionally simple (no external storage) and primarily protects against accidental hammering.
 */
export function enforceGameRateLimit(req: Request, params: {
  /** Stable route id for counters (e.g. "game.prepare-run"). */
  route: string;
  /** Optional session id for per-session limiting. */
  sessionId?: string;
  /** Requests per window per IP. */
  ipMax: number;
  /** Requests per window per session. */
  sessionMax: number;
  /** Window duration in ms. */
  windowMs: number;
}): NextResponse | null {
  maybeWarnInMemoryLimiter(params.route);
  const ip = clientIpFromRequest(req);
  const ipKey = `ip:${params.route}:${ip}`;
  if (!activeRateLimiter.allow(ipKey, params.ipMax, params.windowMs)) {
    return jsonApiError("rate_limited", 429);
  }

  if (params.sessionId) {
    const sessionKey = `session:${params.route}:${params.sessionId}`;
    if (!activeRateLimiter.allow(sessionKey, params.sessionMax, params.windowMs)) {
      return jsonApiError("rate_limited", 429);
    }
  }
  return null;
}

/**
 * Reads and validates the game session from the session cookie.
 */
export async function requireGameSession(): Promise<
  { sessionId: string; session: GameSession } | NextResponse
> {
  const jar = await cookies();
  const sessionId = jar.get(GAME_SESSION_COOKIE)?.value;
  if (!sessionId) {
    return jsonApiError("no_session", 401);
  }
  const session = await readSessionFile(sessionId);
  if (!session) {
    return jsonApiError("expired", 401);
  }
  return { sessionId, session };
}

/**
 * Parses request JSON and normalizes invalid JSON handling for routes.
 */
export async function parseJsonBody<T>(req: Request): Promise<T | NextResponse> {
  try {
    return (await req.json()) as T;
  } catch {
    return jsonApiError("invalid_json", 400);
  }
}

/**
 * Performs a bounded CAS write retry loop for session updates.
 */
export async function writeSessionWithCasRetry(
  sessionId: string,
  initialSession: GameSession,
  buildNext: (current: GameSession) => GameSession,
  attempts = 3,
): Promise<{ persisted: true; session: GameSession } | { persisted: false; session: GameSession | null }> {
  let current = initialSession;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const next = buildNext(current);
    const expectedRevision = current.revision ?? 0;
    const wrote = await writeSessionFileIfRevision(sessionId, next, expectedRevision);
    if (wrote) {
      return { persisted: true, session: next };
    }
    const refreshed = await readSessionFile(sessionId);
    if (!refreshed) {
      return { persisted: false, session: null };
    }
    current = refreshed;
  }
  return { persisted: false, session: current };
}

/**
 * Validates an EVM-like wallet address used by game APIs.
 */
export function normalizeWalletAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!EVM_ADDRESS_PATTERN.test(trimmed)) return null;
  const wallet = trimmed.toLowerCase();
  return wallet;
}

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 40;

const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function normalizeOriginHeader(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");
  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    const u = new URL(referer);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function buildAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  const extras = process.env.ORRA_ALLOWED_ORIGINS?.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) ?? [];
  for (const o of extras) set.add(o.replace(/\/$/, ""));  
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) set.add(`https://${vercel}`);
  const branch = process.env.VERCEL_BRANCH_URL?.trim();
  if (branch) set.add(`https://${branch}`);
  return set;
}

/**
 * Origin gate for `/api/interpret`. Production uses env/Vercel hosts; an empty allow-list fails closed (no open proxy).
 */
export function isInterpretOriginAllowed(request: Request): boolean {
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.ORRA_INTERPRET_TRUST_ANY_ORIGIN === "1") return true;

  const candidate = normalizeOriginHeader(request);
  if (!candidate) return false;

  const allowed = buildAllowedOrigins();
  if (allowed.size === 0) {
    return false;
  }

  return allowed.has(candidate);
}

export function allowInterpretRateLimit(request: Request): boolean {
  const fwd = request.headers.get("x-forwarded-for");
  const key =
    fwd
      ?.split(",")[0]
      ?.trim()
      .slice(0, 64) ||
    request.headers.get("x-real-ip")?.trim().slice(0, 64) ||
    "unknown";

  if (rateBuckets.size > 2000) rateBuckets.clear();

  const now = Date.now();
  const row = rateBuckets.get(key);
  if (!row || now - row.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (row.count >= RATE_MAX_PER_WINDOW) return false;
  row.count += 1;
  return true;
}

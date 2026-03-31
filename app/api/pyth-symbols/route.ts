import { NextResponse } from "next/server";
import { PYTH_HISTORY_SYMBOLS_URL } from "@/lib/pyth-history-api";

const UPSTREAM_FETCH_INIT = { cache: "no-store" as const };

const MEMORY_CACHE_TTL_MS = 300_000;
const MEMORY_CACHE_MAX_KEYS = 48;

type MemoryEntry = { expiresAt: number; payload: unknown };

const memoryCache = new Map<string, MemoryEntry>();

function memoryCacheGet(query: string): unknown | undefined {
  const row = memoryCache.get(query);
  if (!row) return undefined;
  if (Date.now() > row.expiresAt) {
    memoryCache.delete(query);
    return undefined;
  }
  return row.payload;
}

function memoryCacheSet(query: string, payload: unknown) {
  if (memoryCache.size >= MEMORY_CACHE_MAX_KEYS && !memoryCache.has(query)) {
    const first = memoryCache.keys().next().value as string | undefined;
    if (first !== undefined) memoryCache.delete(first);
  }
  memoryCache.set(query, {
    expiresAt: Date.now() + MEMORY_CACHE_TTL_MS,
    payload,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";

  const cached = memoryCacheGet(query);
  if (cached !== undefined) {
    return NextResponse.json(cached);
  }

  const res = await fetch(
    `${PYTH_HISTORY_SYMBOLS_URL}?query=${encodeURIComponent(query)}`,
    UPSTREAM_FETCH_INIT,
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch symbols" },
      { status: res.status },
    );
  }

  const data = await res.json();
  const items = Array.isArray(data) ? data : data?.results ?? [];

  const stableOnly = items.filter(
    (item: { state?: string }) => (item.state ?? "").toLowerCase() === "stable",
  );

  const payload = Array.isArray(data)
    ? stableOnly
    : { ...data, results: stableOnly };

  memoryCacheSet(query, payload);

  return NextResponse.json(payload);
}

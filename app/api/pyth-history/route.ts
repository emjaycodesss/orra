import { NextResponse } from "next/server";
import { PYTH_HISTORY_HISTORICAL_PRICE_URL } from "@/lib/pyth-history-api";
import { logApiTiming } from "@/lib/api-observability";

const BENCHMARKS_URL = "https://benchmarks.pyth.network/v1/shims/tradingview/history";
const BENCHMARKS_FETCH_TIMEOUT_MS = 15_000;

const RANGE_CONFIG: Record<string, { resolution: string; seconds: number; fallbackIntervalSec: number }> = {
  daily: { resolution: "5", seconds: 86400, fallbackIntervalSec: 300 },
  weekly: { resolution: "15", seconds: 604800, fallbackIntervalSec: 900 },
  monthly: { resolution: "60", seconds: 2592000, fallbackIntervalSec: 3600 },
};

interface CandlePoint {
  t: number;
  c: number;
}

async function fetchBenchmarksHistory(
  tvSymbol: string,
  config: { resolution: string; seconds: number },
): Promise<CandlePoint[] | null> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - config.seconds;
  try {
    const res = await fetch(
      `${BENCHMARKS_URL}?symbol=${encodeURIComponent(tvSymbol)}&resolution=${config.resolution}&from=${from}&to=${now}`,
      {
        next: { revalidate: 45 },
        signal: AbortSignal.timeout(BENCHMARKS_FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.s !== "ok" || !Array.isArray(data.t) || !Array.isArray(data.c) || data.t.length === 0) {
      return null;
    }
    return data.t.map((t: number, i: number) => ({ t, c: data.c[i] }));
  } catch {
    return null;
  }
}

const MAX_FALLBACK_POINTS = 50;
const BATCH_SIZE = 10;

async function fetchLazerSnapshot(symbol: string, ts: number): Promise<CandlePoint | null> {
  try {
    const res = await fetch(
      `${PYTH_HISTORY_HISTORICAL_PRICE_URL}?symbol=${encodeURIComponent(symbol)}&timestamp=${ts}`,
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.price == null) return null;
    const exponent = data.exponent ?? -8;
    return { t: ts, c: Number(data.price) * (10 ** exponent) };
  } catch {
    return null;
  }
}

async function fetchLazerFallback(symbol: string, config: { seconds: number; fallbackIntervalSec: number }): Promise<CandlePoint[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - config.seconds;

  const rawPoints = Math.ceil(config.seconds / config.fallbackIntervalSec);
  const step = rawPoints > MAX_FALLBACK_POINTS
    ? Math.ceil(config.seconds / MAX_FALLBACK_POINTS)
    : config.fallbackIntervalSec;

  const timestamps: number[] = [];
  for (let t = from; t <= now; t += step) timestamps.push(t);

  const points: CandlePoint[] = [];
  for (let i = 0; i < timestamps.length; i += BATCH_SIZE) {
    const batch = timestamps.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((ts) => fetchLazerSnapshot(symbol, ts)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) points.push(r.value);
    }
  }

  return points;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? "BTC/USD";
  const range = url.searchParams.get("range") ?? "daily";
  const config = RANGE_CONFIG[range] ?? RANGE_CONFIG.daily;

  const fullSymbol = symbol.includes(".") ? symbol : `Crypto.${symbol}`;

  const t0 = Date.now();
  try {
    let benchmarkResult = await fetchBenchmarksHistory(fullSymbol, config);
    if ((!benchmarkResult || benchmarkResult.length === 0) && fullSymbol !== symbol) {
      benchmarkResult = await fetchBenchmarksHistory(symbol, config);
    }

    const source =
      benchmarkResult && benchmarkResult.length > 0 ? ("benchmark" as const) : ("fallback" as const);
    const result =
      benchmarkResult && benchmarkResult.length > 0
        ? benchmarkResult
        : await fetchLazerFallback(symbol, config);

    logApiTiming("pyth-history", Date.now() - t0, {
      symbol,
      range,
      source,
      points: result.length,
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    logApiTiming("pyth-history", Date.now() - t0, {
      symbol,
      range,
      error: true,
    });
    return NextResponse.json(
      { error: "Failed to fetch price data", details: String(e) },
      { status: 500 }
    );
  }
}

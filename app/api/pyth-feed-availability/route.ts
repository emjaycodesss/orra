export const runtime = "nodejs";

import WebSocket from "ws";
import { NextResponse } from "next/server";
import { PYTH_HISTORY_HISTORICAL_PRICE_URL } from "@/lib/pyth-history-api";
import { devWarn } from "@/lib/dev-warn";

const BENCHMARKS_URL = "https://benchmarks.pyth.network/v1/shims/tradingview/history";

const PYTH_WS_URLS = [
  "wss://pyth-lazer-0.dourolabs.app/v1/stream",
  "wss://pyth-lazer-1.dourolabs.app/v1/stream",
  "wss://pyth-lazer-2.dourolabs.app/v1/stream",
];

const PROPERTIES = [
  "price",
  "emaPrice",
  "confidence",
  "emaConfidence",
  "bestBidPrice",
  "bestAskPrice",
  "publisherCount",
  "marketSession",
  "feedUpdateTimestamp",
  "exponent",
];

interface AvailabilityResult {
  historyAvailable: boolean;
  streamAvailable: boolean;
  available: boolean;
}

interface CacheEntry {
  result: AvailabilityResult;
  expires: number;
}

const CACHE_TTL_MS = 60_000;
const availabilityCache = new Map<string, CacheEntry>();

function getCacheKey(symbol: string, feedId: number): string {
  return `${symbol}:${feedId}`;
}

function getCached(key: string): AvailabilityResult | null {
  const entry = availabilityCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    availabilityCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: AvailabilityResult): void {
  availabilityCache.set(key, { result, expires: Date.now() + CACHE_TTL_MS });
}

async function hasHistoryViaBenchmarks(symbol: string): Promise<boolean> {
  try {
    const fullSymbol = symbol.includes(".") ? symbol : `Crypto.${symbol}`;
    const now = Math.floor(Date.now() / 1000);
    const from = now - 3600;
    const res = await fetch(
      `${BENCHMARKS_URL}?symbol=${encodeURIComponent(fullSymbol)}&resolution=60&from=${from}&to=${now}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data.s === "ok" && Array.isArray(data.t) && data.t.length > 0;
  } catch {
    return false;
  }
}

async function hasHistoryViaDouro(symbol: string): Promise<boolean> {
  try {
    const lazerSymbol = symbol.includes(".") ? symbol : `Crypto.${symbol}`;
    const ts = Math.floor(Date.now() / 1000) - 30;
    const res = await fetch(
      `${PYTH_HISTORY_HISTORICAL_PRICE_URL}?symbol=${encodeURIComponent(lazerSymbol)}&timestamp=${ts}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return data?.price != null;
  } catch {
    return false;
  }
}

async function hasHistory(symbol: string): Promise<boolean> {
  return (await hasHistoryViaBenchmarks(symbol)) || (await hasHistoryViaDouro(symbol));
}

async function hasLiveStream(feedId: number, timeoutMs: number = 5000): Promise<boolean> {
  const token = process.env.PYTH_PRO_TOKEN;
  if (!token) return false;

  return new Promise<boolean>((resolve) => {
    const wsUrl = PYTH_WS_URLS[Math.floor(Math.random() * PYTH_WS_URLS.length)];
    let ws: WebSocket | null = new WebSocket(wsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let settled = false;
    function finish(value: boolean) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws?.close();
      } catch (e) {
        devWarn("api:pyth-feed-availability:ws-close", e);
      }
      ws = null;
      resolve(value);
    }

    const timer = setTimeout(() => finish(false), timeoutMs);

    ws.on("open", () => {
      ws?.send(
        JSON.stringify({
          type: "subscribe",
          subscriptionId: 99,
          priceFeedIds: [feedId],
          properties: PROPERTIES,
          formats: [],
          channel: "fixed_rate@1000ms",
          parsed: true,
          jsonBinaryEncoding: "hex",
        })
      );
    });

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "streamUpdated" && msg.parsed?.priceFeeds?.[0]) {
          finish(true);
        }
      } catch (e) {
        devWarn("api:pyth-feed-availability:ws-message", e);
      }
    });

    ws.on("error", () => finish(false));
    ws.on("close", () => finish(false));
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol");
  const feedIdRaw = url.searchParams.get("feedId");
  const feedId = feedIdRaw ? parseInt(feedIdRaw, 10) : NaN;

  if (!symbol || !Number.isFinite(feedId) || feedId <= 0) {
    return NextResponse.json(
      { error: "symbol and feedId are required" },
      { status: 400 }
    );
  }

  const cacheKey = getCacheKey(symbol, feedId);
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json({ symbol, feedId, ...cached });
  }

  const [historyAvailable, streamAvailable] = await Promise.all([
    hasHistory(symbol),
    hasLiveStream(feedId),
  ]);

  const result: AvailabilityResult = {
    historyAvailable,
    streamAvailable,
    available: historyAvailable || streamAvailable,
  };

  setCache(cacheKey, result);

  return NextResponse.json({ symbol, feedId, ...result });
}

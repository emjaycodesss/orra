import { NextResponse } from "next/server";

const BENCHMARKS_URL = "https://benchmarks.pyth.network/v1/shims/tradingview/history";

const RANGE_CONFIG: Record<string, { resolution: string; seconds: number }> = {
  daily: { resolution: "5", seconds: 86400 },
  weekly: { resolution: "15", seconds: 604800 },
  monthly: { resolution: "60", seconds: 2592000 },
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? "BTC/USD";
  const range = url.searchParams.get("range") ?? "daily";
  const config = RANGE_CONFIG[range] ?? RANGE_CONFIG.daily;

  const fullSymbol = symbol.includes(".") ? symbol : `Crypto.${symbol}`;
  const now = Math.floor(Date.now() / 1000);
  const from = now - config.seconds;

  try {
    const res = await fetch(
      `${BENCHMARKS_URL}?symbol=${encodeURIComponent(fullSymbol)}&resolution=${config.resolution}&from=${from}&to=${now}`
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "Pyth Benchmarks request failed", details: text }, { status: res.status });
    }

    const data = await res.json();

    if (data.s !== "ok" || !data.t || !data.c) {
      return NextResponse.json([]);
    }

    const result = data.t.map((t: number, i: number) => ({
      t,
      c: data.c[i],
    }));

    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch price data", details: String(e) },
      { status: 500 }
    );
  }
}

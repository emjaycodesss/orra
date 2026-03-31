import { NextResponse } from "next/server";
import { PYTH_HISTORY_HISTORICAL_PRICE_URL } from "@/lib/pyth-history-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol");
  const hours = parseInt(url.searchParams.get("hours") ?? "1", 10);

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const intervalSec = Math.max(60, Math.floor((hours * 3600) / 60));
  const timestamps: number[] = [];
  for (let t = now - hours * 3600; t <= now; t += intervalSec) {
    timestamps.push(t);
  }

  try {
    const results = await Promise.allSettled(
      timestamps.map(async (ts) => {
        const res = await fetch(
          `${PYTH_HISTORY_HISTORICAL_PRICE_URL}?symbol=${encodeURIComponent(symbol)}&timestamp=${ts}`,
          { next: { revalidate: 60 } }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.price == null || data?.confidence == null) return null;
        const exponent = data.exponent ?? -8;
        const exp = 10 ** exponent;
        const price = Number(data.price) * exp;
        const conf = Number(data.confidence) * exp;
        const confPct = Math.abs(price) > 0 ? (conf / Math.abs(price)) * 100 : 0;
        return {
          t: ts * 1000,
          price,
          conf: confPct,
          publisherCount: data.publisher_count ?? 0,
          spread: data.best_ask_price && data.best_bid_price
            ? ((Number(data.best_ask_price) - Number(data.best_bid_price)) * exp / Math.abs(price)) * 100
            : 0,
        };
      })
    );

    const points = results
      .filter((r): r is PromiseFulfilledResult<{ t: number; price: number; conf: number; publisherCount: number; spread: number } | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter(Boolean);

    return NextResponse.json(points);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { PYTH_HISTORY_HISTORICAL_PRICE_URL } from "@/lib/pyth-history-api";
import { logApiTiming } from "@/lib/api-observability";
import {
  HISTORY_SYMBOL_TO_HERMES_ID,
  HERMES_ID_TO_HISTORY_SYMBOL,
} from "@/lib/ticker-feed-meta";

const HERMES_PRICE_AT_TIME = "https://hermes.pyth.network/v2/updates/price";

type HermesParsedRow = {
  id: string;
  price?: { price: string; expo: number };
};

function normalizeHermesId(id: string): string {
  return id.toLowerCase().replace(/^0x/, "");
}

/** One Hermes GET with multiple ids[] replaces N parallel Douro historical_price calls for known ticker symbols. */
async function fetchHermesBatchAtPublishTime(
  publishTimeSec: number,
  hermesIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (hermesIds.length === 0) return out;

  const qp = new URLSearchParams();
  qp.set("parsed", "true");
  for (const id of hermesIds) {
    qp.append("ids[]", id);
  }

  const res = await fetch(`${HERMES_PRICE_AT_TIME}/${publishTimeSec}?${qp}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return out;

  const data = (await res.json()) as { parsed?: HermesParsedRow[] };
  const parsed = data.parsed ?? [];
  for (const row of parsed) {
    const sym = HERMES_ID_TO_HISTORY_SYMBOL.get(normalizeHermesId(row.id));
    if (!sym || !row.price?.price) continue;
    const expo = row.price.expo;
    const price = Number(row.price.price) * 10 ** expo;
    if (!Number.isFinite(price) || price === 0) continue;
    out.set(sym, price);
  }
  return out;
}

async function fetchDouroSingle(
  symbol: string,
  timestamp: string,
): Promise<{ symbol: string; price: number } | null> {
  const res = await fetch(
    `${PYTH_HISTORY_HISTORICAL_PRICE_URL}?symbol=${encodeURIComponent(symbol)}&timestamp=${timestamp}`,
    { next: { revalidate: 300 } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.price == null || data?.exponent == null) return null;
  return { symbol, price: Number(data.price) * 10 ** data.exponent };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const timestamp = url.searchParams.get("timestamp");
  const symbols = url.searchParams.getAll("symbols");

  if (!timestamp || symbols.length === 0) {
    return NextResponse.json({ error: "timestamp and symbols required" }, { status: 400 });
  }

  const t0 = Date.now();
  const publishTimeSec = parseInt(timestamp, 10);
  if (!Number.isFinite(publishTimeSec) || publishTimeSec <= 0) {
    return NextResponse.json({ error: "invalid timestamp" }, { status: 400 });
  }

  try {
    const seenId = new Set<string>();
    const uniqueHermesIds: string[] = [];
    for (const sym of symbols) {
      const hid = HISTORY_SYMBOL_TO_HERMES_ID.get(sym);
      if (!hid) continue;
      const n = normalizeHermesId(hid);
      if (seenId.has(n)) continue;
      seenId.add(n);
      uniqueHermesIds.push(hid);
    }

    const batchPrices = await fetchHermesBatchAtPublishTime(
      publishTimeSec,
      uniqueHermesIds,
    );

    const prices: { symbol: string; price: number }[] = [];
    const needDouro: string[] = [];

    for (const sym of symbols) {
      const p = batchPrices.get(sym);
      if (p != null && p > 0) {
        prices.push({ symbol: sym, price: p });
      } else {
        needDouro.push(sym);
      }
    }

    if (needDouro.length > 0) {
      const douroResults = await Promise.allSettled(
        needDouro.map((symbol) => fetchDouroSingle(symbol, timestamp)),
      );
      for (const r of douroResults) {
        if (r.status === "fulfilled" && r.value) prices.push(r.value);
      }
    }

    logApiTiming("pyth-history-snapshot", Date.now() - t0, {
      symbolCount: symbols.length,
      hermesBatchIds: uniqueHermesIds.length,
      douroFallbackCount: needDouro.length,
      resultCount: prices.length,
    });

    return NextResponse.json(prices);
  } catch {
    logApiTiming("pyth-history-snapshot", Date.now() - t0, {
      error: true,
    });
    return NextResponse.json({ error: "Failed to fetch historical prices" }, { status: 500 });
  }
}

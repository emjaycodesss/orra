/**
 * Multi-feed Hermes snapshot for trivia prepare-run: five oracle symbols,
 * random comparison window (1h / 1d / 1w / 1m), per-feed return % with shorter-window fallback.
 * Reuses canonical hex ids from lib/ticker-feed-meta.ts (same as dashboard / history).
 */

import { logApiError } from "@/lib/api-observability";
import { TICKER_FEED_META, type TickerFeedMeta } from "@/lib/ticker-feed-meta";
import { parseHermesParsedPrice } from "@/lib/game/hermes-parsed-price";

const HERMES_LATEST_URL = "https://hermes.pyth.network/v2/updates/price/latest";
const HERMES_PRICE_AT_TIME_URL = "https://hermes.pyth.network/v2/updates/price";

/** Product ids for game oracle basket (matches plan: BTC, ETH, PYTH, SOL, XAU). */
const GAME_ORACLE_PYTH_IDS = [1, 2, 3, 6, 346] as const;

export type ComparisonWindowKey = "1h" | "1d" | "1w" | "1m";

const WINDOW_SECONDS: Record<ComparisonWindowKey, number> = {
  "1h": 60 * 60,
  "1d": 24 * 60 * 60,
  "1w": 7 * 24 * 60 * 60,
  "1m": 30 * 24 * 60 * 60, // ~30d; Hermes history may truncate — fallback chain handles gaps
};

/** Shorter spans to try when anchor price is missing (longest → shortest). */
function fallbackChain(from: ComparisonWindowKey): ComparisonWindowKey[] {
  const order: ComparisonWindowKey[] = ["1m", "1w", "1d", "1h"];
  const i = order.indexOf(from);
  if (i < 0) return ["1h"];
  return order.slice(i);
}

export interface OracleFeedSnapshot {
  meta: TickerFeedMeta;
  /** Display symbol for prompts, e.g. BTC/USD */
  quizSymbol: string;
  price: number;
  confidence: number;
  confidencePct: number;
  publishTime: number;
  /** Window rolled for this prepare-run (before per-feed fallback). */
  intendedComparisonWindow: ComparisonWindowKey;
  /** Window used to compute return (may be shorter if Hermes lacked anchor data). */
  effectiveComparisonWindow: ComparisonWindowKey;
  /** (latest - anchor) / anchor * 100; NaN if uncomputable. */
  returnOverWindowPct: number;
  /** Latest update older than threshold — still usable for level questions but risky for freshness claims. */
  stale: boolean;
}

export interface GameOracleSnapshot {
  intendedComparisonWindow: ComparisonWindowKey;
  windowLabelHuman: string;
  feeds: OracleFeedSnapshot[];
  /** Feeds with finite returnOverWindowPct (directional questions). */
  feedsWithReturn: OracleFeedSnapshot[];
}

/**
 * Oracle fields exposed to trivia LLM prompts — price, trend, freshness only (no confidence band).
 * Full {@link OracleFeedSnapshot} still exists for internal Hermes math; map at the boundary.
 */
type OracleFeedSnapshotForGameAi = {
  quizSymbol: string;
  price: number;
  publishTime: number;
  intendedComparisonWindow: ComparisonWindowKey;
  effectiveComparisonWindow: ComparisonWindowKey;
  returnOverWindowPct: number;
  stale: boolean;
};

export function oracleFeedToGameAiShape(feed: OracleFeedSnapshot): OracleFeedSnapshotForGameAi {
  return {
    quizSymbol: feed.quizSymbol,
    price: feed.price,
    publishTime: feed.publishTime,
    intendedComparisonWindow: feed.intendedComparisonWindow,
    effectiveComparisonWindow: feed.effectiveComparisonWindow,
    returnOverWindowPct: feed.returnOverWindowPct,
    stale: feed.stale,
  };
}

/** Snapshot feeds stripped for game AI / client-safe summaries (no confidence keys). */
export function gameOracleFeedsForAi(snapshot: GameOracleSnapshot): OracleFeedSnapshotForGameAi[] {
  return snapshot.feeds.map(oracleFeedToGameAiShape);
}

const STALE_LATEST_SEC = 15 * 60;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function quizSymbolFromMeta(m: TickerFeedMeta): string {
  const s = m.historySymbol.replace(/^Crypto\./, "").replace(/^Metal\./, "");
  return s;
}

function pickRandomWindow(): ComparisonWindowKey {
  const keys: ComparisonWindowKey[] = ["1h", "1d", "1w", "1m"];
  return keys[Math.floor(Math.random() * keys.length)]!;
}

/** Human phrase for the window used to compute returnOverWindowPct (per-feed effective window). */
export function humanWindowLabel(w: ComparisonWindowKey): string {
  switch (w) {
    case "1h":
      return "the past hour";
    case "1d":
      return "the past day";
    case "1w":
      return "the past week";
    case "1m":
      return "the past month";
    default:
      return "the selected period";
  }
}

/**
 * Fetches latest + historical anchor for each game oracle feed; applies fallback windows per feed.
 * Never throws: network/parse failures become `null` and are logged for ops.
 */
export async function fetchGameOracleSnapshot(
  options?: { timeoutMs?: number },
): Promise<GameOracleSnapshot | null> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  try {
    const intended = pickRandomWindow();
    const metaList = TICKER_FEED_META.filter((m) =>
      (GAME_ORACLE_PYTH_IDS as readonly number[]).includes(m.id),
    );
    if (metaList.length !== GAME_ORACLE_PYTH_IDS.length) {
      logApiError("lib/game/pyth-hermes-snapshot", new Error("missing_ticker_meta_for_game_oracle_ids"), {
        expectedCount: GAME_ORACLE_PYTH_IDS.length,
        resolvedCount: metaList.length,
      });
    }

    const latestParams = new URLSearchParams();
    latestParams.set("parsed", "true");
    for (const m of metaList) {
      latestParams.append("ids[]", m.hermesId);
    }

    const latestRes = await fetchWithTimeout(`${HERMES_LATEST_URL}?${latestParams.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    }, timeoutMs);
    if (!latestRes.ok) {
      logApiError(
        "lib/game/pyth-hermes-snapshot",
        new Error("hermes_latest_http_error"),
        { status: latestRes.status, timeoutMs },
      );
      return null;
    }

    const latestJson = await latestRes.json();
    const parsedArr = (latestJson as { parsed?: unknown[] }).parsed;
    if (!Array.isArray(parsedArr)) {
      logApiError("lib/game/pyth-hermes-snapshot", new Error("hermes_latest_invalid_shape"), {
        timeoutMs,
      });
      return null;
    }

    const latestById = new Map<string, { price: number; confidence: number; publishTime: number }>();
    for (const row of parsedArr) {
      const parsed = parseHermesParsedPrice({ parsed: [row] });
      const idRaw = row && typeof row === "object" ? (row as { id?: string }).id : undefined;
      if (!parsed || typeof idRaw !== "string") continue;
      const norm = idRaw.replace(/^0x/i, "").toLowerCase();
      latestById.set(norm, parsed);
    }

    /** Per-feed history chain (parallel across feeds — major latency win vs sequential). */
    const feeds = (
      await Promise.all(
        metaList.map(async (meta) => {
          const hid = meta.hermesId.replace(/^0x/i, "").toLowerCase();
          const latest = latestById.get(hid);
          if (!latest) return null;

          const nowSec = Math.floor(Date.now() / 1000);
          const stale = nowSec - latest.publishTime > STALE_LATEST_SEC;
          const confidencePct = (latest.confidence / latest.price) * 100;

          let effectiveWindow: ComparisonWindowKey = intended;
          let returnPct = NaN;

          const chain = fallbackChain(intended);
          for (const w of chain) {
            const anchorTs = Math.max(1, latest.publishTime - WINDOW_SECONDS[w]);
            const histParams = new URLSearchParams();
            histParams.set("parsed", "true");
            histParams.append("ids[]", meta.hermesId);
            const histRes = await fetchWithTimeout(
              `${HERMES_PRICE_AT_TIME_URL}/${anchorTs}?${histParams.toString()}`,
              { method: "GET", headers: { Accept: "application/json" } },
              timeoutMs,
            );
            if (!histRes.ok) continue;
            const histJson = await histRes.json();
            const hist = parseHermesParsedPrice(histJson);
            if (hist && hist.price > 0) {
              effectiveWindow = w;
              returnPct = ((latest.price - hist.price) / hist.price) * 100;
              break;
            }
          }

          const row: OracleFeedSnapshot = {
            meta,
            quizSymbol: quizSymbolFromMeta(meta),
            price: Number(latest.price.toFixed(6)),
            confidence: Number(latest.confidence.toFixed(8)),
            confidencePct: Number(confidencePct.toFixed(6)),
            publishTime: latest.publishTime,
            intendedComparisonWindow: intended,
            effectiveComparisonWindow: effectiveWindow,
            returnOverWindowPct: Number.isFinite(returnPct) ? Number(returnPct.toFixed(4)) : NaN,
            stale,
          };
          return row;
        }),
      )
    ).filter((x): x is OracleFeedSnapshot => x !== null);

    if (feeds.length === 0) {
      logApiError("lib/game/pyth-hermes-snapshot", new Error("hermes_no_feed_rows_after_parse"), {
        timeoutMs,
        latestRowCount: parsedArr.length,
      });
      return null;
    }

    const feedsWithReturn = feeds.filter((f) => Number.isFinite(f.returnOverWindowPct));

    return {
      intendedComparisonWindow: intended,
      windowLabelHuman: humanWindowLabel(intended),
      feeds,
      feedsWithReturn,
    };
  } catch (err) {
    logApiError("lib/game/pyth-hermes-snapshot", err, { timeoutMs, op: "fetchGameOracleSnapshot" });
    return null;
  }
}

const LIVE_SLOT_COUNT = 12;

/**
 * Maps 12 live question slots to oracle rows so each distinct symbol appears first (shuffled),
 * then round-robins the pool. Requires at least three feeds with a computable return.
 */
export function assignOracleFeedsToTwelveLiveSlots(feedsWithReturn: OracleFeedSnapshot[]): OracleFeedSnapshot[] {
  if (feedsWithReturn.length < 3) {
    throw new Error("oracle_insufficient_feeds_with_return");
  }
  const pool = [...feedsWithReturn].sort(() => Math.random() - 0.5);
  const distinctSyms = [...new Set(pool.map((f) => f.quizSymbol))].sort(() => Math.random() - 0.5);
  const symToFeed = new Map<string, OracleFeedSnapshot>();
  for (const f of pool) {
    if (!symToFeed.has(f.quizSymbol)) symToFeed.set(f.quizSymbol, f);
  }
  const out: OracleFeedSnapshot[] = [];
  const head = Math.min(distinctSyms.length, LIVE_SLOT_COUNT);
  for (let i = 0; i < head; i++) {
    const sym = distinctSyms[i]!;
    const feed = symToFeed.get(sym);
    if (feed) out.push(feed);
  }
  let rr = 0;
  while (out.length < LIVE_SLOT_COUNT) {
    out.push(pool[rr % pool.length]!);
    rr += 1;
  }
  return out.slice(0, LIVE_SLOT_COUNT);
}

/** Same bar as prepare-run: need enough feeds with a directional return. */
const MIN_FEEDS_WITH_RETURN_FOR_ORACLE = 3;

type PickOracleFeedForAdHocResult =
  | { ok: true; feed: OracleFeedSnapshot }
  | { ok: false; reason: "insufficient_feeds" | "symbol_not_found" };

/**
 * Choose one row from the multi-feed snapshot for `/api/game/question-ai`.
 * Optional `requestedSymbol`: label (BTC), quiz symbol (BTC/USD), or history tail — case-insensitive.
 */
export function pickOracleFeedForAdHocQuestion(
  snapshot: GameOracleSnapshot,
  requestedSymbol?: string | null,
): PickOracleFeedForAdHocResult {
  const pool = snapshot.feedsWithReturn;
  if (pool.length < MIN_FEEDS_WITH_RETURN_FOR_ORACLE) {
    return { ok: false, reason: "insufficient_feeds" };
  }
  const req = requestedSymbol?.trim();
  if (!req) {
    return { ok: true, feed: pool[Math.floor(Math.random() * pool.length)]! };
  }
  const q = req.toUpperCase();
  const found = pool.find((f) => {
    const qs = f.quizSymbol.toUpperCase();
    const lab = f.meta.label.toUpperCase();
    const hist = f.meta.historySymbol.toUpperCase().replace(/^CRYPTO\./, "").replace(/^METAL\./, "");
    return (
      qs === q ||
      lab === q ||
      hist === q ||
      qs.replace(/\//g, "") === q.replace(/\//g, "") ||
      hist.replace(/\//g, "") === q.replace(/\//g, "")
    );
  });
  if (!found) return { ok: false, reason: "symbol_not_found" };
  return { ok: true, feed: found };
}

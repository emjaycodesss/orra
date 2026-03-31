export interface PythStreamData {
  priceFeedId: number;
  price: string;
  emaPrice: string;
  confidence: string;
  emaConfidence: string;
  bestBidPrice: string;
  bestAskPrice: string;
  publisherCount: number;
  marketSession: MarketSession;
  feedUpdateTimestamp: number;
  exponent: number;
}

export type MarketSession =
  | "preMarket"
  | "regular"
  | "postMarket"
  | "overNight"
  | "closed";

export type Regime = "bull" | "bear" | "neutral";

export type SignalClarity = "tight" | "moderate" | "wide" | "extreme";

export type ConfidenceDrift = "widening" | "narrowing" | "stable";

export interface OracleState {
  price: number;
  emaPrice: number;
  confidence: number;
  emaConfidence: number;
  bid: number;
  ask: number;
  confidencePct: number;
  emaPct: number;
  signalClarity: SignalClarity;
  confidenceDrift: ConfidenceDrift;
  regime: Regime;
  momentumPct: number;
  spreadPct: number;
  publisherCount: number;
  marketSession: MarketSession;
  feedUpdateTimestamp: number;
  extremeDisagreement: boolean;
  isStale: boolean;
  warnings: string[];
}

function toEpochMs(tsRaw: number): number {
  const ts = Number(tsRaw ?? 0);
  if (!Number.isFinite(ts) || ts <= 0) return 0;
  if (ts > 1e14) return Math.floor(ts / 1000);
  if (ts > 1e11) return Math.floor(ts);
  if (ts > 1e9) return Math.floor(ts * 1000);
  return 0;
}

export function computeOracleState(
  raw: PythStreamData,
  computedEmaMantissa?: number | null,
): OracleState {
  const exp = 10 ** raw.exponent;
  const price = Number(raw.price) * exp;
  const emaPrice = Number(raw.emaPrice) * exp;
  const confidence = Number(raw.confidence) * exp;
  const bid = Number(raw.bestBidPrice) * exp;
  const ask = Number(raw.bestAskPrice) * exp;

  const absPrice = Math.abs(price);
  const confidencePct = absPrice > 0 ? (confidence / absPrice) * 100 : 0;

  const emaConf = (() => {
    if (computedEmaMantissa != null) return computedEmaMantissa * exp;
    const pythEmaConf = Number(raw.emaConfidence) * exp;
    return absPrice > 0 && pythEmaConf / absPrice > 0.1 ? confidence : pythEmaConf;
  })();

  const emaPct = absPrice > 0 ? (emaConf / absPrice) * 100 : 0;

  let signalClarity: SignalClarity;
  if (confidencePct < 0.5) signalClarity = "tight";
  else if (confidencePct < 1) signalClarity = "moderate";
  else if (confidencePct < 2) signalClarity = "wide";
  else signalClarity = "extreme";

  const extremeDisagreement = confidencePct >= 2.0;

  const diff = confidencePct - emaPct;
  let confidenceDrift: ConfidenceDrift;
  if (diff > 0.1) confidenceDrift = "widening";
  else if (diff < -0.1) confidenceDrift = "narrowing";
  else confidenceDrift = "stable";

  let regime: Regime;
  if (price > emaPrice) regime = "bull";
  else if (price < emaPrice) regime = "bear";
  else regime = "neutral";

  const absEma = Math.abs(emaPrice);
  const momentumPct = absEma > 0 ? ((price - emaPrice) / absEma) * 100 : 0;

  const spreadPct = absPrice > 0 ? ((ask - bid) / absPrice) * 100 : 0;

  const feedTsMs = toEpochMs(raw.feedUpdateTimestamp);
  const isStale = feedTsMs > 0 ? Date.now() - feedTsMs > 5000 : true;

  const warnings: string[] = [];
  if (raw.publisherCount < 3) {
    warnings.push("Few publishers on this feed — the mark may be fragile.");
  }
  if (isStale && raw.marketSession !== "closed") {
    warnings.push("Last update is stale — verify freshness before acting.");
  }
  if (isStale && raw.marketSession === "closed") {
    warnings.push("Session is closed and updates are naturally quiet.");
  }
  if (extremeDisagreement) {
    warnings.push("Very wide confidence band — publishers disagree strongly on price.");
  }
  if (raw.marketSession === "closed") {
    warnings.push("Traditional session is closed — liquidity and marks may be thin.");
  }

  return {
    price,
    emaPrice,
    confidence,
    emaConfidence: emaConf,
    bid,
    ask,
    confidencePct,
    emaPct,
    signalClarity,
    confidenceDrift,
    regime,
    momentumPct,
    spreadPct,
    publisherCount: raw.publisherCount,
    marketSession: raw.marketSession,
    feedUpdateTimestamp: raw.feedUpdateTimestamp,
    extremeDisagreement,
    isStale,
    warnings,
  };
}

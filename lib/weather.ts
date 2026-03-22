export type WeatherSeverity = "clear" | "cloudy" | "stormy" | "fog";
export type StormTrend = "intensifying" | "clearing" | "steady";
export type Regime = "bull" | "bear" | "neutral";
export type MarketSession =
  | "preMarket"
  | "regular"
  | "postMarket"
  | "overNight"
  | "closed";

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

export interface WeatherState {
  price: number;
  emaPrice: number;
  confidence: number;
  emaConfidence: number;
  bid: number;
  ask: number;
  confidencePct: number;
  emaPct: number;
  weatherSeverity: WeatherSeverity;
  stormTrend: StormTrend;
  regime: Regime;
  momentumPct: number;
  spreadPct: number;
  publisherCount: number;
  marketSession: MarketSession;
  feedUpdateTimestamp: number;
  fogMode: boolean;
  isStale: boolean;
  warnings: string[];
}

export function computeWeatherState(raw: PythStreamData): WeatherState {
  const exp = 10 ** raw.exponent;
  const price = Number(raw.price) * exp;
  const emaPrice = Number(raw.emaPrice) * exp;
  const confidence = Number(raw.confidence) * exp;
  const emaConf = Number(raw.emaConfidence) * exp;
  const bid = Number(raw.bestBidPrice) * exp;
  const ask = Number(raw.bestAskPrice) * exp;

  const absPrice = Math.abs(price);
  const confidencePct = absPrice > 0 ? (confidence / absPrice) * 100 : 0;
  const emaPct = absPrice > 0 ? (emaConf / absPrice) * 100 : 0;

  let weatherSeverity: WeatherSeverity;
  if (confidencePct < 0.5) weatherSeverity = "clear";
  else if (confidencePct < 1) weatherSeverity = "cloudy";
  else if (confidencePct < 2) weatherSeverity = "stormy";
  else weatherSeverity = "fog";

  const fogMode = confidencePct >= 2.0;

  const diff = confidencePct - emaPct;
  let stormTrend: StormTrend;
  if (diff > 0.1) stormTrend = "intensifying";
  else if (diff < -0.1) stormTrend = "clearing";
  else stormTrend = "steady";

  let regime: Regime;
  if (price > emaPrice) regime = "bull";
  else if (price < emaPrice) regime = "bear";
  else regime = "neutral";

  const absEma = Math.abs(emaPrice);
  const momentumPct = absEma > 0 ? ((price - emaPrice) / absEma) * 100 : 0;

  const spreadPct = absPrice > 0 ? ((ask - bid) / absPrice) * 100 : 0;

  const isStale =
    Date.now() - raw.feedUpdateTimestamp / 1000 > 5000;

  const warnings: string[] = [];
  if (raw.publisherCount < 3)
    warnings.push("few voices speak \u2014 the oracle\u2019s data is thin");
  if (isStale)
    warnings.push(
      "the oracle\u2019s gaze has drifted \u2014 prices may be stale"
    );
  if (fogMode)
    warnings.push(
      "the storm is severe \u2014 the oracle speaks through fog today"
    );
  if (raw.marketSession === "closed")
    warnings.push(
      "this realm sleeps \u2014 the oracle reads echoes"
    );

  return {
    price,
    emaPrice,
    confidence,
    emaConfidence: emaConf,
    bid,
    ask,
    confidencePct,
    emaPct,
    weatherSeverity,
    stormTrend,
    regime,
    momentumPct,
    spreadPct,
    publisherCount: raw.publisherCount,
    marketSession: raw.marketSession,
    feedUpdateTimestamp: raw.feedUpdateTimestamp,
    fogMode,
    isStale,
    warnings,
  };
}

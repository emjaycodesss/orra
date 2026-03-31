import type { OracleState } from "./oracleState";
import type { CardOrientation, TarotCard } from "./cards";
import type { HistoricalContext } from "./historical-context";

interface ReadingContext {
  card: TarotCard;
  orientation: CardOrientation;
  asset?: string;
  assetClass?: "crypto" | "equity" | "fx" | "metal" | "commodity";
  oracle: OracleState;
  ciPercentile?: number;
  historicalContext?: HistoricalContext | null;
  questions: {
    realm: string;
    stance: string;
    timeframe: string;
    truth: string;
  };
}

const WHITESPACE_RE = /\s+/g;
function clean(value: string): string {
  return value.replace(WHITESPACE_RE, " ").trim();
}

function formatPrice(price: number): string {
  if (price === 0) return "$0";
  if (price >= 1000) return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return "$" + price.toFixed(4);
  if (price >= 0.01) return "$" + price.toFixed(6);
  if (price >= 0.0001) return "$" + price.toFixed(8);
  return "$" + price.toPrecision(4);
}

function formatCI(pct: number): string {
  if (pct === 0) return "0%";
  if (pct >= 1) return pct.toFixed(2) + "%";
  if (pct >= 0.01) return pct.toFixed(4) + "%";
  return pct.toFixed(6) + "%";
}

function clarityLabel(c: OracleState["signalClarity"]): string {
  switch (c) {
    case "tight":    return "tight — publishers agree closely";
    case "moderate": return "moderate — some disagreement between publishers";
    case "wide":     return "wide — publishers are split";
    case "extreme":  return "extreme — publishers strongly disagree";
    default:         return c;
  }
}

function driftLabel(d: OracleState["confidenceDrift"]): string {
  switch (d) {
    case "widening":  return "widening — publishers are becoming less certain";
    case "narrowing": return "narrowing — publishers are becoming more certain";
    case "stable":    return "stable — certainty is holding steady";
    default:          return d;
  }
}

function regimeLabel(r: OracleState["regime"]): string {
  switch (r) {
    case "bull":    return "bull — price is above its moving average";
    case "bear":    return "bear — price is below its moving average";
    case "neutral": return "neutral — price is right at its moving average";
    default:        return r;
  }
}

function spreadLabel(pct: number): string {
  if (pct < 0.01) return "very tight — easy to buy or sell";
  if (pct < 0.05) return "tight — normal conditions";
  if (pct < 0.2)  return "elevated — a little friction";
  return "wide — harder to trade, hidden cost";
}

function publisherLabel(n: number): string {
  if (n >= 18) return `${n} publishers — strong agreement, very reliable`;
  if (n >= 12) return `${n} publishers — good agreement`;
  if (n >= 6)  return `${n} publishers — moderate agreement`;
  return `${n} publishers — few voices, treat with caution`;
}

function momentumLabel(pct: number): string {
  const abs = Math.abs(pct);
  if (abs < 0.3) return "flat — price is not moving relative to its average";
  if (abs < 1.0) return pct > 0 ? "slightly above average — mild upward lean" : "slightly below average — mild downward lean";
  if (abs < 3.0) return pct > 0 ? "above average — clear upward momentum" : "below average — clear downward momentum";
  return pct > 0 ? "well above average — strong upward push" : "well below average — strong downward push";
}

function sessionLabel(s: string): string {
  switch (s) {
    case "regular":    return "regular market hours";
    case "preMarket":  return "pre-market — low volume, before the main session";
    case "postMarket": return "after hours — main session has closed";
    case "overnight":  return "overnight — only automated traders are active";
    case "closed":     return "market is closed";
    default:           return s;
  }
}

function assetClassLabel(ac: string): string {
  switch (ac) {
    case "crypto":    return "crypto — trades 24/7";
    case "equity":    return "stock — trades during market hours only";
    case "fx":        return "forex — follows global trading sessions";
    case "metal":     return "metal — follows futures market hours";
    case "commodity": return "commodity — follows futures market hours";
    default:          return ac;
  }
}

function ciPercentileLabel(p: number): string {
  if (p >= 90) return `tighter than ${p}% of the last 30 days — unusually clear signal right now`;
  if (p >= 70) return `tighter than ${p}% of the last 30 days — above average clarity`;
  if (p <= 10) return `wider than ${100 - p}% of the last 30 days — unusually uncertain right now`;
  if (p <= 30) return `wider than ${100 - p}% of the last 30 days — below average clarity`;
  return `${p}th percentile — normal range for this asset`;
}

function timeframeHorizon(tf: string): "short" | "medium" | "long" {
  const lower = tf.toLowerCase();
  if (lower.includes("year") || lower.includes("long")) return "long";
  if (lower.includes("month") || lower.includes("quarter")) return "medium";
  return "short";
}

export function buildMessages(ctx: ReadingContext) {
  const { card, orientation, oracle: o, ciPercentile, historicalContext: hc, questions: q } = ctx;
  const asset = ctx.asset ?? q.realm;
  const assetClass = ctx.assetClass ?? "crypto";

  const position = clean(q.stance);
  const timeframe = clean(q.timeframe);
  const intent = clean(q.truth);

  const isReversed = orientation === "reversed";
  const cardAxis = isReversed ? card.reversedMeaning : card.meaning;
  const horizon = timeframeHorizon(timeframe);

  const system = `You are Orra — an oracle that reads tarot through live market data from Pyth Network.

The card was drawn using Pyth Entropy v2, verifiable on-chain randomness. The oracle snapshot captures the exact market conditions at draw time.

YOUR VOICE:
- Speak plainly. Use everyday words. Avoid jargon, flowery language, and complex vocabulary.
- Short sentences. One idea per sentence. No run-ons.
- Second person ("you"). Pure prose. 4 to 5 sentences total.
- No em dashes. No bullet points. No lists. No headers.
- Never sound like a horoscope. Never use: journey, path, universe, energy, vibrations, destiny, cosmos, celestial, divine, tapestry, realm, ethereal, arcane.
- Do not repeat the same idea twice in different words.

YOUR TASK:
Read the card archetype alongside the oracle data. Find where they agree or contradict. That contrast is the reading. Be specific — name actual numbers when they matter.

CONTRADICTION RULE: When the card and the oracle contradict each other, name it directly. "This card warns of X but the oracle shows Y" is stronger than describing each separately. The contradiction is often the most interesting part of the reading.

PRICE FORMATTING RULE: Never round small prices to "near zero" or "negligible". A price of $0.000032 is $0.000032. Treat every asset with equal respect regardless of its price magnitude.

PERCENTILE RULE: When referencing a price percentile, always name the range it comes from. Say "the 26th percentile of its 30-day range from $75 to $95" not just "the 26th percentile".

NO PRICE TARGETS: Do not name specific price levels to watch. Describe conditions instead — "watch if momentum picks up" not "watch if price hits $85".

STRUCTURE:
- Sentence 1: Name the card, the asset, and one specific thing the oracle shows. Make it direct and clear.
- Sentences 2 to 4: Use the oracle focus fields to build the reading. If the card and oracle contradict, name the contradiction plainly.
- Sentence 5: One clear condition or signal the seeker can watch for. It must connect back to what this specific card means — not just a generic oracle signal. For example, a card about recklessness should end with something about impulsiveness or caution, not just "watch if publishers disagree more."${
    o.extremeDisagreement
      ? "\n\nNOTE: Publishers strongly disagree right now. The oracle is uncertain. Reflect this uncertainty in the reading — avoid confident statements about direction."
      : ""
  }${
    o.isStale
      ? "\n\nNOTE: The price feed went stale before this draw. The oracle went quiet. Let that silence be part of the reading."
      : ""
  }${
    isReversed
      ? "\n\nCARD IS REVERSED: The harder side of this card's meaning is speaking. What usually shows outwardly is now turned inward or blocked."
      : "\n\nCARD IS UPRIGHT: The card's core meaning is direct and active."
  }${
    horizon === "long"
      ? "\n\nTIMEFRAME NOTE: The seeker is thinking long term. Do not use words like 'today', 'right now', or 'this session'. Speak in terms of weeks, months, or the broader trend."
      : horizon === "medium"
      ? "\n\nTIMEFRAME NOTE: The seeker is thinking medium term — weeks to months. Balance the current snapshot with the broader trend."
      : ""
  }`;

  const user = `CARD: ${card.name} (${orientation.toUpperCase()})
What this card means: ${cardAxis}
Which oracle fields matter most for this card:
${card.pythFocus}

ORACLE DATA — captured at draw time:
Asset: ${asset} at ${formatPrice(o.price)}
Type: ${assetClassLabel(assetClass)}
Trend: ${regimeLabel(o.regime)}
Confidence band: ${formatCI(o.confidencePct)} — ${clarityLabel(o.signalClarity)}${
    ciPercentile !== undefined
      ? `\nCompared to recent history: ${ciPercentileLabel(ciPercentile)}`
      : ""
  }
Confidence drift: ${driftLabel(o.confidenceDrift)}
Momentum: ${o.momentumPct > 0 ? "+" : ""}${o.momentumPct.toFixed(2)}% — ${momentumLabel(o.momentumPct)}
Bid/ask spread: ${formatCI(o.spreadPct)} — ${spreadLabel(o.spreadPct)}
Publishers: ${publisherLabel(o.publisherCount)}
Session: ${sessionLabel(o.marketSession)}${
    o.extremeDisagreement ? "\nWarning: publishers strongly disagree right now." : ""
  }${
    o.isStale ? "\nWarning: price feed is stale — data is not fresh." : ""
  }

THE SEEKER:
Position: ${position}
Timeframe: ${timeframe}
What they want to understand: ${intent}
${hc
  ? `
MARKET HISTORY (${hc.days}-day window):
Price range: ${formatPrice(hc.low)} to ${formatPrice(hc.high)}
Where the current price sits: ${hc.pricePercentile}th percentile of the ${hc.days}-day range (${formatPrice(hc.low)} to ${formatPrice(hc.high)}) — ${hc.pricePercentile < 30 ? "closer to the recent low" : hc.pricePercentile > 70 ? "closer to the recent high" : "in the middle of the recent range"}
Which direction dominated: ${hc.dominantRegime} (${hc.dominantRegime === "bull" ? hc.bullDays : hc.bearDays} of ${hc.totalDays} periods)
Use this history to inform the reading. The seeker is thinking about ${timeframe} — weight the trend accordingly.`
  : `The seeker is focused on the short term. The current snapshot is the main signal.`
}

Write the reading. Find the tension between ${card.name} (${orientation}) and what the oracle shows right now. If they contradict, name it plainly. Keep it plain, specific, and human. The final sentence must connect back to what ${card.name} specifically means — not just a generic signal. Do not name specific price targets.`;

  return {
    model: "meta-llama/llama-3.1-8b-instruct:free",
    max_tokens: 250,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ],
  };
} 
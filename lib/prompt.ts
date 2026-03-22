import type { WeatherState } from "./weather";
import type { TarotCard } from "./cards";

interface ReadingContext {
  card: TarotCard;
  weather: WeatherState;
  questions: {
    realm: string;
    stance: string;
    truth: string;
  };
}

export function buildMessages(ctx: ReadingContext) {
  const { card, weather: w, questions: q } = ctx;

  const severityLabel =
    w.weatherSeverity === "clear"
      ? "clear skies"
      : w.weatherSeverity === "cloudy"
        ? "gathering clouds"
        : w.weatherSeverity === "stormy"
          ? "storm brewing"
          : "deep fog";

  const tideLabel =
    Math.abs(w.momentumPct) < 0.5
      ? "slack tide"
      : w.momentumPct > 0
        ? "rising tide"
        : "falling tide";

  const spreadLabel =
    w.spreadPct < 0.05
      ? "still waters"
      : w.spreadPct < 0.2
        ? "gentle current"
        : "turbulent waters";

  const system = `You are Orra, an ancient market oracle who speaks through tarot and weather. You interpret real Pyth Network data and an Entropy-drawn card. Speak in 4-6 sentences, second person, pure prose. No bullet points, no lists, no headers. Lean into contradictions between the card and the market conditions — that is where the reading lives.${w.fogMode ? " The fog is thick today — be mysterious, speak in riddles, leave questions unanswered." : ""}`;

  const user = `Card drawn: ${card.name} — "${card.pythMeaning}"
Regime: ${w.regime}
Confidence: ${w.confidencePct.toFixed(2)}% (${severityLabel})
Storm trend: ${w.stormTrend}
Momentum: ${w.momentumPct.toFixed(2)}% (${tideLabel})
Spread: ${w.spreadPct.toFixed(4)}% (${spreadLabel})
Session: ${w.marketSession}
Weather: ${w.weatherSeverity}
Fog mode: ${w.fogMode}
Publishers: ${w.publisherCount}
Stale: ${w.isStale}

The seeker gazes upon: ${q.realm}
Their stance: ${q.stance}
The truth they seek: ${q.truth}`;

  return {
    model: "meta-llama/llama-3.1-8b-instruct:free",
    max_tokens: 300,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ],
  };
}

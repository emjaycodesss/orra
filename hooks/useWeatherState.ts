import { useMemo } from "react";
import { computeWeatherState, type PythStreamData, type WeatherState } from "@/lib/weather";

const DEFAULT_WEATHER: WeatherState = {
  price: 0,
  emaPrice: 0,
  confidence: 0,
  emaConfidence: 0,
  bid: 0,
  ask: 0,
  confidencePct: 0,
  emaPct: 0,
  weatherSeverity: "clear",
  stormTrend: "steady",
  regime: "neutral",
  momentumPct: 0,
  spreadPct: 0,
  publisherCount: 0,
  marketSession: "closed",
  feedUpdateTimestamp: 0,
  fogMode: false,
  isStale: true,
  warnings: [],
};

export function useWeatherState(raw: PythStreamData | null): WeatherState {
  return useMemo(() => {
    if (!raw) return DEFAULT_WEATHER;
    return computeWeatherState(raw);
  }, [raw]);
}

"use client";

import type { WeatherState } from "@/lib/weather";

interface Props {
  weather: WeatherState;
}

function trendArrow(trend: string): string {
  if (trend === "intensifying") return "/";
  if (trend === "clearing") return "\\";
  return "--";
}

function tideLabel(pct: number): string {
  const abs = Math.abs(pct);
  if (abs < 0.5) return "slack tide";
  return pct > 0 ? "rising tide" : "falling tide";
}

function spreadLabel(pct: number): string {
  if (pct < 0.05) return "still waters";
  if (pct < 0.2) return "gentle current";
  return "turbulent";
}

function sessionLabel(session: string): string {
  const labels: Record<string, string> = {
    preMarket: "pre-market",
    regular: "regular",
    postMarket: "post-market",
    overNight: "overnight",
    closed: "closed",
  };
  return labels[session] ?? session;
}

function MetricCard({
  label,
  value,
  sub,
  accent,
  delay,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
  delay: string;
}) {
  return (
    <div className={`card-surface p-4 flex flex-col gap-3 opacity-0 ${delay}`}>
      <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-ink-400">
        {label}
      </span>
      <span
        className="text-[22px] font-light tabular leading-none"
        style={{ color: accent ?? "var(--ink-50)" }}
      >
        {value}
      </span>
      <span className="text-[11px] font-medium text-ink-300">{sub}</span>
    </div>
  );
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(Math.abs(pct), 100);
  return (
    <div className="w-full h-1 rounded-full bg-night-700 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function WeatherCards({ weather }: Props) {
  const regimeColor = weather.regime === "bull" ? "var(--bull)" : weather.regime === "bear" ? "var(--bear)" : "var(--ink-300)";

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`card-surface p-4 flex flex-col gap-3 opacity-0 animate-fade-up-1`}>
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-ink-400">
            publisher agreement
          </span>
          <span className="text-[22px] font-light tabular leading-none text-ink-50">
            {weather.confidencePct.toFixed(3)}%
          </span>
          <MiniBar pct={weather.confidencePct * 20} color={
            weather.confidencePct < 0.5
              ? "var(--clear)"
              : weather.confidencePct < 1
                ? "var(--ink-200)"
                : weather.confidencePct < 2
                  ? "var(--storm)"
                  : "var(--fog)"
          } />
          <span className="text-[11px] font-medium text-ink-300">
            {weather.stormTrend} {trendArrow(weather.stormTrend)}
          </span>
        </div>

        <MetricCard
          label="momentum"
          value={`${weather.momentumPct > 0 ? "+" : ""}${weather.momentumPct.toFixed(3)}%`}
          sub={tideLabel(weather.momentumPct)}
          accent={regimeColor}
          delay="animate-fade-up-2"
        />

        <MetricCard
          label="market depth"
          value={`${weather.spreadPct.toFixed(4)}%`}
          sub={spreadLabel(weather.spreadPct)}
          delay="animate-fade-up-3"
        />

        <div className={`card-surface p-4 flex flex-col gap-3 opacity-0 animate-fade-up-4`}>
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-ink-400">
            session
          </span>
          <span className="text-[22px] font-light leading-none text-ink-50">
            {sessionLabel(weather.marketSession)}
          </span>
          <div className="flex items-center gap-2 mt-auto">
            <div className="flex -space-x-0.5">
              {Array.from({ length: Math.min(weather.publisherCount, 12) }).map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full border border-night-800"
                  style={{ backgroundColor: regimeColor, opacity: 0.6 + (i / 20) }}
                />
              ))}
            </div>
            <span className="text-[11px] font-medium text-ink-300">
              {weather.publisherCount} sources
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

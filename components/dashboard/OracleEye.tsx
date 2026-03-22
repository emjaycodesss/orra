"use client";

import type { Regime } from "@/lib/weather";

interface Props {
  price: number;
  momentumPct: number;
  regime: Regime;
  publisherCount: number;
  assetName: string;
  feedUpdateTimestamp: number;
  confidencePct: number;
  weatherSeverity: string;
}

function formatPrice(price: number): string {
  if (price === 0) return "--";
  if (price >= 1000)
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (price >= 1)
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
  return price.toFixed(8);
}

function severityLabel(s: string): string {
  const map: Record<string, string> = {
    clear: "CLEAR",
    cloudy: "OVERCAST",
    stormy: "STORM",
    fog: "FOG",
  };
  return map[s] ?? s.toUpperCase();
}

export function OracleEye({
  price,
  momentumPct,
  regime,
  publisherCount,
  assetName,
  feedUpdateTimestamp,
  confidencePct,
  weatherSeverity,
}: Props) {
  const accentColor = regime === "bull" ? "var(--bull)" : regime === "bear" ? "var(--bear)" : "var(--ink-400)";
  const ringPct = Math.min(Math.abs(momentumPct) * 25, 100);
  const circumference = 2 * Math.PI * 88;
  const dashOffset = circumference - (ringPct / 100) * circumference;
  const publishers = Array.from({ length: publisherCount }, (_, i) => i);

  const severityColor =
    weatherSeverity === "clear"
      ? "var(--clear)"
      : weatherSeverity === "cloudy"
        ? "var(--ink-300)"
        : weatherSeverity === "stormy"
          ? "var(--storm)"
          : "var(--fog)";

  return (
    <div className="relative flex flex-col items-center gap-6 opacity-0 animate-fade-up">
      <div className="relative">
        <svg width="220" height="220" viewBox="0 0 220 220" className="absolute inset-0">
          <circle
            cx="110" cy="110" r="88"
            fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5"
          />
          <circle
            cx="110" cy="110" r="88"
            fill="none" stroke={accentColor} strokeWidth="1.5"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-90 110 110)"
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1), stroke 0.6s ease" }}
          />
          <circle
            cx="110" cy="110" r="100"
            fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5"
          />
          {publishers.map((i) => {
            const angle = (i / Math.max(publisherCount, 1)) * 360 - 90;
            const rad = (angle * Math.PI) / 180;
            const cx = 110 + 100 * Math.cos(rad);
            const cy = 110 + 100 * Math.sin(rad);
            return (
              <circle
                key={i} cx={cx} cy={cy} r="1.5"
                fill={accentColor} opacity="0.5"
                className="animate-pulse-dot"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            );
          })}
        </svg>

        <div
          className="w-[220px] h-[220px] flex flex-col items-center justify-center rounded-full"
          key={feedUpdateTimestamp}
        >
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-400 mb-1">
            {assetName}
          </span>
          <span
            className="text-[42px] font-extralight tabular text-ink-50 leading-none"
            style={{ transition: "color 0.4s ease" }}
          >
            {formatPrice(price)}
          </span>
          <div className="flex items-center gap-3 mt-3">
            <span
              className="text-[13px] font-semibold tabular"
              style={{ color: accentColor, transition: "color 0.4s ease" }}
            >
              {momentumPct > 0 ? "+" : ""}
              {momentumPct.toFixed(3)}%
            </span>
            <span className="w-px h-3 bg-night-600" />
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: severityColor }}
              />
              <span className="text-[10px] font-semibold tracking-[0.15em] text-ink-400">
                {severityLabel(weatherSeverity)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-medium text-ink-400 tracking-wider uppercase">
        <span>{publisherCount} publishers</span>
        <span className="w-px h-2.5 bg-night-600" />
        <span>conf {confidencePct.toFixed(3)}%</span>
      </div>
    </div>
  );
}

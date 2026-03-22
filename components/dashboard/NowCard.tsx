"use client";

import type { WeatherState } from "@/lib/weather";

interface Props {
  weather: WeatherState;
  assetName: string;
  periodOpen: number;
}

function formatPrice(price: number): string {
  if (price === 0) return "--";
  if (price >= 1000)
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)
    return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return price.toFixed(8);
}

export function NowCard({ weather, assetName, periodOpen }: Props) {

  const rawChange = periodOpen > 0
    ? ((weather.price - periodOpen) / periodOpen) * 100
    : 0;
  const changePct = Object.is(rawChange, -0) ? 0 : rawChange;
  const changePositive = changePct >= 0;
  const decimals = Math.abs(changePct) < 0.01 && changePct !== 0 ? 4 : Math.abs(changePct) < 0.1 ? 3 : 2;

  return (
    <div className="card-surface p-6 flex flex-col h-full opacity-0 animate-fade-up">
      <div className="mb-5">
        <span className="text-[10px] font-normal uppercase text-ink-900">{assetName}</span>
      </div>

      <div className="mb-4">
        <span className="block text-[40px] font-semibold tabular text-ink-900 leading-none" style={{ letterSpacing: "-0.4px" }}>
          {formatPrice(weather.price)}
        </span>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="text-[13px] font-semibold tabular"
            style={{ color: changePositive ? "var(--bull)" : "var(--bear)" }}
          >
            {changePositive ? "+" : ""}{changePct.toFixed(decimals)}%
          </span>
          <span className="text-[11px] text-ink-400">from open</span>
        </div>
      </div>

      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-normal uppercase text-ink-900">Publishers</span>
          <span className="text-[10px] font-medium text-ink-400">
            {weather.publisherCount > 0 ? `${weather.publisherCount} active` : "--"}
          </span>
        </div>
        <div className="flex flex-wrap gap-[5px]">
          {Array.from({ length: 20 }, (_, i) => {
            const active = i < weather.publisherCount;
            return (
              <div
                key={i}
                className="w-[7px] h-[7px] rounded-full transition-all duration-300"
                style={{
                  backgroundColor: active ? "var(--accent)" : "var(--surface-3)",
                  boxShadow: active ? "0 0 4px rgba(124, 58, 237, 0.4)" : "none",
                  opacity: active ? 1 : 0.5,
                }}
              />
            );
          })}
        </div>
        <span className="text-[9px] text-ink-400 mt-2 block">
          {weather.publisherCount >= 10 ? "Strong consensus" : weather.publisherCount >= 5 ? "Moderate consensus" : weather.publisherCount > 0 ? "Low consensus" : "--"}
        </span>
      </div>
    </div>
  );
}

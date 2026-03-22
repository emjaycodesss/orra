"use client";

import { useState, useCallback, useMemo } from "react";
import { Navbar } from "@/components/shared/Navbar";
import { NowCard } from "@/components/dashboard/NowCard";
import { HighlightsGrid } from "@/components/dashboard/HighlightsGrid";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { AssetSearch } from "@/components/dashboard/AssetSearch";
import { WarningBanner } from "@/components/dashboard/WarningBanner";
import { usePythStream } from "@/hooks/usePythStream";
import { useWeatherState } from "@/hooks/useWeatherState";
import { useSparkline, type TimeRange } from "@/hooks/useSparkline";

export default function DashboardPage() {
  const [feedId, setFeedId] = useState(1);
  const [assetSymbol, setAssetSymbol] = useState("BTC/USD");
  const [assetName, setAssetName] = useState("BTC/USD");
  const [timeRange, setTimeRange] = useState<TimeRange>("daily");

  const data = usePythStream(feedId);
  const weather = useWeatherState(data);
  const sparklineData = useSparkline(assetSymbol, timeRange);

  const periodOpen = useMemo(() => {
    if (sparklineData.length === 0) return 0;
    return sparklineData[0].close;
  }, [sparklineData]);

  const handleAssetSelect = useCallback(
    (id: number, symbol: string, name: string) => {
      setFeedId(id);
      setAssetSymbol(symbol);
      setAssetName(name);
    },
    []
  );

  return (
    <>
      <Navbar />
      <WarningBanner warnings={weather.warnings} />

      <main className="min-h-screen pt-14">
        <div className="w-full px-3 sm:px-6 py-8">
          <header className="relative z-50 flex items-center justify-between mb-6 opacity-0 animate-fade-up">
            <AssetSearch onSelect={handleAssetSelect} />
            <div className="flex items-center gap-6">
              {(["daily", "weekly", "monthly"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeRange(t)}
                  className={`pb-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors duration-150 ${
                    timeRange === t
                      ? "text-ink-900 border-b-2 border-accent"
                      : "text-ink-400 hover:text-ink-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 mb-5">
            <NowCard weather={weather} assetName={assetName} periodOpen={periodOpen} />
            <HighlightsGrid weather={weather} sparklineData={sparklineData} periodOpen={periodOpen} timeRange={timeRange} />
          </div>

          <div className="opacity-0 animate-fade-up-3">
            <Sparkline data={sparklineData} regime={weather.regime} timeRange={timeRange} />
          </div>
        </div>
      </main>
    </>
  );
}

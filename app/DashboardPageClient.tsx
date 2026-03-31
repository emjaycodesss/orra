"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useMemo, useRef } from "react";
import { Navbar } from "@/components/shared/Navbar";
import { TickerStrip } from "@/components/shared/TickerStrip";
import { AssetSearch } from "@/components/dashboard/AssetSearch";
import { SparklineRangeToggle } from "@/components/dashboard/SparklineRangeToggle";
import { WarningBanner } from "@/components/dashboard/WarningBanner";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { usePythStream, usePythStreamStatus } from "@/hooks/usePythStream";
import { useOracleState } from "@/hooks/useOracleState";
import { useSparkline, type TimeRange } from "@/hooks/useSparkline";
import { useWallClockMs } from "@/hooks/useWallClock";
import { inferAssetClass } from "@/lib/asset-class";
import { getMarketStatus } from "@/lib/market-hours";
import { getAssetLogoUrl } from "@/lib/asset-logo";

const DashboardLoadedCharts = dynamic(
  () =>
    import("@/components/dashboard/DashboardLoadedCharts").then(
      (m) => m.DashboardLoadedCharts,
    ),
  { loading: () => <DashboardSkeleton /> },
);

// Idle prefetch for charts chunk (module scope avoids eslint restricted-imports on dynamic path).
function scheduleDashboardChartsChunkPrefetch() {
  const load = () => {
    void import("@/components/dashboard/DashboardLoadedCharts");
  };
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(load, { timeout: 2000 });
  } else {
    queueMicrotask(load);
  }
}

if (typeof window !== "undefined") {
  scheduleDashboardChartsChunkPrefetch();
}

export default function DashboardPageClient() {
  const [feedId, setFeedId] = useState(1);
  const [assetSymbol, setAssetSymbol] = useState("BTC/USD");
  const [assetName, setAssetName] = useState("BTC/USD");
  const [timeRange, setTimeRange] = useState<TimeRange>("daily");
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);
  const [selectionWarningSymbol, setSelectionWarningSymbol] = useState<string | null>(null);
  const selectionRequestRef = useRef(0);
  const switchedAtRef = useRef(Date.now());
  const lastRenderableBySymbolRef = useRef<Record<string, number>>({});
  const nowMs = useWallClockMs();

  const data = usePythStream(feedId);
  const connectionStatus = usePythStreamStatus();
  const oracle = useOracleState(data);
  const { data: sparklineData, status: sparklineStatus } = useSparkline(assetSymbol, timeRange);

  const logoUrl = useMemo(() => getAssetLogoUrl(assetSymbol), [assetSymbol]);
  const assetDisplayName = assetName || assetSymbol;
  const latestClose = useMemo(
    () => (sparklineData.length > 0 ? sparklineData[sparklineData.length - 1].close : 0),
    [sparklineData],
  );
  const candidatePrice = oracle.price > 0 ? oracle.price : latestClose;
  if (candidatePrice > 0) {
    lastRenderableBySymbolRef.current[assetSymbol] = candidatePrice;
  }
  const fallbackPrice =
    latestClose > 0 ? latestClose : (lastRenderableBySymbolRef.current[assetSymbol] ?? 0);
  const hasAnyData = data !== null || sparklineData.length > 0;
  const assetClass = useMemo(() => inferAssetClass(assetSymbol), [assetSymbol]);
  const marketStatus = useMemo(() => getMarketStatus(assetClass), [assetClass]);
  const elapsedSinceSwitchMs = Math.max(0, nowMs - switchedAtRef.current);
  const noDataTimeoutExpired = elapsedSinceSwitchMs >= 8000;
  const sparklineResolved = sparklineStatus === "ready" || sparklineStatus === "empty";
  // Show grid on sparkline price if live SSE is slow (3s).
  const LIVE_ORACLE_FALLBACK_MS = 3000;
  const liveOracleFallbackExpired = elapsedSinceSwitchMs >= LIVE_ORACLE_FALLBACK_MS;
  const liveOracleReady =
    data !== null || connectionStatus === "error" || liveOracleFallbackExpired;
  const isLoaded = sparklineResolved && liveOracleReady;
  const bannerWarnings = useMemo(() => {
    const filteredWarnings = oracle.warnings.filter(
      (w) =>
        !w.toLowerCase().includes("traditional session is closed") &&
        !w.toLowerCase().includes("session is closed and updates are naturally quiet"),
    );

    const hasRenderableFallback = fallbackPrice > 0;
    const showSelectionWarning =
      !!selectionWarning &&
      selectionWarningSymbol === assetSymbol &&
      !hasAnyData &&
      noDataTimeoutExpired &&
      !hasRenderableFallback;
    const noFeedMessage =
      showSelectionWarning && selectionWarning
        ? selectionWarning
        : `No active oracle feed is available right now for ${assetDisplayName}. Try another asset or check back later.`;

    if (!hasAnyData && noDataTimeoutExpired && !hasRenderableFallback && connectionStatus !== "connecting") {
      return [noFeedMessage, ...filteredWarnings];
    }

    const showHistoricalOnlyWarning =
      !!selectionWarning &&
      selectionWarningSymbol === assetSymbol &&
      selectionWarning.toLowerCase().includes("historical trend only");
    if (showHistoricalOnlyWarning) {
      return [selectionWarning as string, ...filteredWarnings];
    }

    if (!marketStatus.open && assetClass !== "crypto") {
      const statusText = marketStatus.label.toLowerCase();
      return [
        `${assetDisplayName} market is ${statusText}. ${marketStatus.nextEvent}.`,
        ...filteredWarnings,
      ];
    }
    if (filteredWarnings.length === 0 && !selectionWarning) {
      return [];
    }
    return filteredWarnings;
  }, [
    oracle.warnings,
    marketStatus,
    assetClass,
    assetSymbol,
    assetDisplayName,
    hasAnyData,
    noDataTimeoutExpired,
    fallbackPrice,
    selectionWarning,
    selectionWarningSymbol,
    connectionStatus,
  ]);

  const periodOpen = useMemo(() => {
    if (sparklineData.length === 0) return 0;
    return sparklineData[0].close;
  }, [sparklineData]);

  const handleAssetSelect = useCallback(
    async (id: number, symbol: string, name: string) => {
      setSelectionWarning(null);
      setSelectionWarningSymbol(null);
      switchedAtRef.current = Date.now();
      setFeedId(id);
      setAssetSymbol(symbol);
      setAssetName(name);
      const requestId = ++selectionRequestRef.current;

      try {
        const res = await fetch(
          `/api/pyth-feed-availability?symbol=${encodeURIComponent(symbol)}&feedId=${id}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const availability = await res.json();
        if (selectionRequestRef.current !== requestId) return;
        if (!availability.available) {
          setSelectionWarning(
            `${name} currently has no active Pyth feed data (no live stream or recent history). Please choose another asset or try again later.`,
          );
          setSelectionWarningSymbol(symbol);
        } else if (!availability.streamAvailable && availability.historyAvailable) {
          setSelectionWarning("Live oracle metrics unavailable for this feed");
          setSelectionWarningSymbol(symbol);
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const handleRangeChange = useCallback((nextRange: TimeRange) => {
    switchedAtRef.current = Date.now();
    setTimeRange(nextRange);
  }, []);

  const bannerKey = useMemo(() => bannerWarnings.join("||"), [bannerWarnings]);

  return (
    <>
      <Navbar>
        <div className="flex w-full items-center gap-2 sm:gap-3 sm:w-auto">
          <div className="min-w-0 flex-1 sm:flex-none">
            <AssetSearch onSelect={handleAssetSelect} />
          </div>
          <SparklineRangeToggle value={timeRange} onChange={handleRangeChange} />
        </div>
      </Navbar>
      <TickerStrip onAssetSelect={(id, symbol, label) => handleAssetSelect(id, symbol, label)} />
      <WarningBanner key={bannerKey} warnings={bannerWarnings} />

      <main className="min-h-screen pt-24 sm:pt-16">
        <div className="w-full px-3 py-6 sm:px-6 sm:py-8 xl:px-10">
          {!isLoaded ? (
            <DashboardSkeleton />
          ) : (
            <DashboardLoadedCharts
              oracle={oracle}
              assetName={assetName}
              periodOpen={periodOpen}
              logoUrl={logoUrl}
              liveData={data}
              assetSymbol={assetSymbol}
              timeRange={timeRange}
              fallbackPrice={fallbackPrice}
              hasLiveOracle={data !== null}
              sparklineData={sparklineData}
              sparklineStatus={sparklineStatus}
            />
          )}
        </div>
      </main>
    </>
  );
}

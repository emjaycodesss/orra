"use client";

import { NowCard } from "@/components/dashboard/NowCard";
import { HighlightsGrid } from "@/components/dashboard/HighlightsGrid";
import { Sparkline } from "@/components/dashboard/Sparkline";
import type {
  SparklinePoint,
  SparklineStatus,
  TimeRange,
} from "@/hooks/useSparkline";
import type { OracleState, PythStreamData } from "@/lib/oracleState";

interface DashboardLoadedChartsProps {
  oracle: OracleState;
  assetName: string;
  periodOpen: number;
  logoUrl: string | null;
  liveData: PythStreamData | null;
  assetSymbol: string;
  timeRange: TimeRange;
  fallbackPrice: number;
  hasLiveOracle: boolean;
  sparklineData: SparklinePoint[];
  sparklineStatus: SparklineStatus;
}

/**
 * Chart-heavy dashboard region loaded as a separate chunk so the shell (nav, ticker, hooks)
 * compiles and hydrates without pulling SVG/canvas work into the initial dashboard bundle.
 */
export function DashboardLoadedCharts({
  oracle,
  assetName,
  periodOpen,
  logoUrl,
  liveData,
  assetSymbol,
  timeRange,
  fallbackPrice,
  hasLiveOracle,
  sparklineData,
  sparklineStatus,
}: DashboardLoadedChartsProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr] mb-6">
        <NowCard
          oracle={oracle}
          assetName={assetName}
          periodOpen={periodOpen}
          logoUrl={logoUrl}
          liveData={liveData}
          assetSymbol={assetSymbol}
          timeRange={timeRange}
          fallbackPrice={fallbackPrice}
          hasLiveOracle={hasLiveOracle}
        />
        <HighlightsGrid
          oracle={oracle}
          sparklineData={sparklineData}
          periodOpen={periodOpen}
          timeRange={timeRange}
          assetSymbol={assetSymbol}
          hasLiveOracle={hasLiveOracle}
        />
      </div>

      <div className="animate-fade-up-3 opacity-0">
        <Sparkline
          data={sparklineData}
          status={sparklineStatus}
          regime={oracle.regime}
          timeRange={timeRange}
        />
      </div>
    </>
  );
}

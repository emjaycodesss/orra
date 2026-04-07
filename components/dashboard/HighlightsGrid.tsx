"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { OracleState } from "@/lib/oracleState";
import type { SparklinePoint, TimeRange } from "@/hooks/useSparkline";
import { inferAssetClass } from "@/lib/asset-class";
import { computeDashboardOracleSignal, oracleSignalColor } from "@/lib/oracle-signal";
import { formatPeriodLowHigh, formatUsdBidAsk, formatUsdSpreadAbsolute } from "@/lib/format-price";
import { TradingSessionClocks, type TradingAssetClass } from "./TradingSessionClocks";
import { useReadingAudio } from "@/components/reading/ReadingAudioProvider";


interface Props {
  oracle: OracleState;
  sparklineData: SparklinePoint[];
  periodOpen: number;
  timeRange: TimeRange;
  assetSymbol: string;
  hasLiveOracle: boolean;
}

const RANGE_LABELS: Record<TimeRange, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
};

function LiquidityTank({ spreadPct }: { spreadPct: number }) {
  const depth = spreadPct < 0.02 ? 90 : spreadPct < 0.05 ? 75 : spreadPct < 0.1 ? 55 : spreadPct < 0.3 ? 35 : spreadPct < 0.5 ? 20 : 8;
  const w = 44;
  const h = 72;
  const wall = 2.5;
  const iW = w - wall * 2;
  const iH = h - wall * 2 - 18;
  const fH = (depth / 100) * iH;
  const fY = wall + 4 + iH - fH;

  const topColor = depth >= 45 ? "#A78BFA" : depth >= 25 ? "#C4B5FD" : "#DDD6FE";
  const botColor = depth >= 45 ? "#7C3AED" : depth >= 25 ? "#8B5CF6" : "#A78BFA";

  const waveA = 2.5;
  const wD1 = `M ${wall} ${fY} Q ${wall + iW * 0.25} ${fY - waveA} ${wall + iW * 0.5} ${fY} Q ${wall + iW * 0.75} ${fY + waveA} ${wall + iW} ${fY} L ${wall + iW} ${wall + 4 + iH} L ${wall} ${wall + 4 + iH} Z`;
  const wD2 = `M ${wall} ${fY} Q ${wall + iW * 0.25} ${fY + waveA} ${wall + iW * 0.5} ${fY} Q ${wall + iW * 0.75} ${fY - waveA} ${wall + iW} ${fY} L ${wall + iW} ${wall + 4 + iH} L ${wall} ${wall + 4 + iH} Z`;

  const uid = `tank-${depth}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block shrink-0">
      <defs>
        <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={topColor} stopOpacity="0.7" />
          <stop offset="100%" stopColor={botColor} stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x={wall} y={wall + 4} width={iW} height={iH} rx="6" />
        </clipPath>
      </defs>

      <rect x={wall} y={wall + 4} width={iW} height={iH} rx="6" fill="var(--surface-3)" />

      <g clipPath={`url(#${uid}-clip)`}>
        <path d={wD1} fill={`url(#${uid}-water)`} className="transition-all duration-700 ease-out">
          <animate attributeName="d" values={`${wD1};${wD2};${wD1}`} dur="2.5s" repeatCount="indefinite" />
        </path>

        {depth > 15 && (
          <circle cx={wall + iW * 0.6} cy={fY + fH * 0.5} r="1.5" fill="white" opacity="0.2">
            <animate attributeName="cy" values={`${fY + fH * 0.7};${fY + 3};${fY + fH * 0.7}`} dur="4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.08;0.2" dur="4s" repeatCount="indefinite" />
          </circle>
        )}
        {depth > 25 && (
          <circle cx={wall + iW * 0.3} cy={fY + fH * 0.6} r="1" fill="white" opacity="0.15">
            <animate attributeName="cy" values={`${fY + fH * 0.6};${fY + 5};${fY + fH * 0.6}`} dur="5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.15;0.06;0.15" dur="5s" repeatCount="indefinite" />
          </circle>
        )}
        {depth > 35 && (
          <circle cx={wall + iW * 0.75} cy={fY + fH * 0.3} r="1" fill="white" opacity="0.18">
            <animate attributeName="cy" values={`${fY + fH * 0.4};${fY + 2};${fY + fH * 0.4}`} dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.18;0.06;0.18" dur="3.5s" repeatCount="indefinite" />
          </circle>
        )}
        {depth > 50 && (
          <circle cx={wall + iW * 0.45} cy={fY + fH * 0.8} r="1.2" fill="white" opacity="0.16">
            <animate attributeName="cy" values={`${fY + fH * 0.85};${fY + 4};${fY + fH * 0.85}`} dur="6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.16;0.05;0.16" dur="6s" repeatCount="indefinite" />
          </circle>
        )}
        {depth > 60 && (
          <circle cx={wall + iW * 0.2} cy={fY + fH * 0.4} r="0.8" fill="white" opacity="0.14">
            <animate attributeName="cy" values={`${fY + fH * 0.5};${fY + 6};${fY + fH * 0.5}`} dur="4.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.14;0.04;0.14" dur="4.5s" repeatCount="indefinite" />
          </circle>
        )}
      </g>

      <rect x={wall + 2} y={wall + 6} width={iW * 0.25} height={iH - 4} rx="3" fill={`url(#${uid}-glass)`} />

      {[0.16, 0.33, 0.5, 0.66, 0.83].map((pct) => (
        <line key={pct}
          x1={wall + iW - 6} y1={wall + 4 + iH * (1 - pct)} x2={wall + iW - 2} y2={wall + 4 + iH * (1 - pct)}
          stroke="var(--ink-500)" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
      ))}

      <text x={w / 2} y={wall + 4 + iH + 12} textAnchor="middle" fontSize="10" fontFamily="Manrope" fontWeight="600" fill="var(--ink-400)">
        {depth}%
      </text>
    </svg>
  );
}

export function HighlightsGrid({ oracle, sparklineData, periodOpen, timeRange, assetSymbol, hasLiveOracle }: Props) {
  const readingAudio = useReadingAudio();
  const latestClose = sparklineData.length > 0 ? sparklineData[sparklineData.length - 1].close : 0;
  const currentPrice = oracle.price > 0 ? oracle.price : latestClose;
  const changePct = periodOpen > 0 ? ((currentPrice - periodOpen) / periodOpen) * 100 : 0;
  const changeColor = changePct > 0.01 ? "var(--positive)" : changePct < -0.01 ? "var(--danger)" : "var(--ink-400)";
  const trendDir = changePct > 0.1 ? "Trending up" : changePct < -0.1 ? "Trending down" : "Sideways";

  const liqWord = oracle.spreadPct < 0.02 ? "Deep" : oracle.spreadPct < 0.1 ? "Normal" : oracle.spreadPct < 0.5 ? "Thin" : "Dangerous";
  const liqSub = oracle.spreadPct < 0.02 ? "Easy to enter and exit" : oracle.spreadPct < 0.1 ? "Normal conditions" : oracle.spreadPct < 0.5 ? "Expect slippage" : "High slippage risk";
  const spreadDollar = oracle.ask - oracle.bid;
  const bidAskDisplay = hasLiveOracle ? formatUsdBidAsk(oracle.bid, oracle.ask) : { bid: "--" as const, ask: "--" as const };

  const signal = useMemo(
    () =>
      computeDashboardOracleSignal(oracle, changePct, {
        rangeLabel: RANGE_LABELS[timeRange],
        symbolKey: assetSymbol,
      }),
    [oracle, changePct, timeRange, assetSymbol],
  );
  const sigColor = oracleSignalColor(signal.label);

  const { periodHigh, periodLow } = useMemo(() => {
    if (sparklineData.length === 0) return { periodHigh: 0, periodLow: 0 };
    let lo = sparklineData[0].close, hi = sparklineData[0].close;
    for (let i = 1; i < sparklineData.length; i++) {
      if (sparklineData[i].close < lo) lo = sparklineData[i].close;
      if (sparklineData[i].close > hi) hi = sparklineData[i].close;
    }
    return { periodHigh: hi, periodLow: lo };
  }, [sparklineData]);

  const periodLowHigh = formatPeriodLowHigh(periodLow, periodHigh);
  const assetClass = inferAssetClass(assetSymbol) as TradingAssetClass;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-surface p-4 sm:p-5 flex flex-col opacity-0 animate-fade-up-1">
          <span className="text-xs font-medium uppercase tracking-wider text-ink-900 mb-3">Trend</span>
          <span className="text-[18px] sm:text-[22px] font-semibold tabular leading-none" style={{ color: changeColor, letterSpacing: "-0.4px" }}>
            {changePct > 0 ? "+" : ""}{changePct.toFixed(2)}%
          </span>
          <span className="text-[13px] font-medium text-ink-400 mt-1.5 mb-3">{trendDir} {RANGE_LABELS[timeRange]}</span>
          <div className="mt-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-ink-400">Low: <span className="tabular text-ink-500">{periodLowHigh.low}</span></span>
              <span className="text-xs font-medium text-ink-400">High: <span className="tabular text-ink-500">{periodLowHigh.high}</span></span>
            </div>
            <div className="relative" style={{ height: "12px", display: "flex", alignItems: "center" }}>
              <div className="w-full rounded-full" style={{
                height: "6px",
                background: "linear-gradient(180deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.18) 100%)",
                boxShadow: "inset 0 1px 2px rgba(26,18,37,0.12), inset 0 -0.5px 0 rgba(255,255,255,0.5)",
              }} />
              {periodHigh > periodLow && (
                <div
                  className="absolute"
                  style={{
                    width: "5px",
                    height: "18px",
                    top: "-3px",
                    borderRadius: "3px",
                    background: "linear-gradient(90deg, #7C3AED 0%, #8B5CF6 50%, #7C3AED 100%)",
                    left: `${Math.min(100, Math.max(0, ((currentPrice - periodLow) / (periodHigh - periodLow)) * 100))}%`,
                    transform: "translateX(-50%)",
                    boxShadow: "inset 1px 0 0 rgba(255,255,255,0.2), inset -1px 0 0 rgba(26,18,37,0.2), 0 1px 2px rgba(26,18,37,0.2)",
                  }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="card-surface p-4 sm:p-5 flex flex-col opacity-0 animate-fade-up-1">
          <span className="text-xs font-medium uppercase tracking-wider text-ink-900 mb-3">Order Book</span>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-400">Bid</span>
              <span className="text-sm font-semibold tabular text-ink-900">{bidAskDisplay.bid}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-400">Ask</span>
              <span className="text-sm font-semibold tabular text-ink-900">{bidAskDisplay.ask}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 relative" style={{ borderTop: "1px dashed var(--surface-4)" }}>
            <div className="absolute top-0 left-0 right-0" style={{ borderTop: "1px dashed rgba(255,255,255,0.5)" }} />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-400">Spread</span>
              <span className="text-[13px] tabular text-ink-500">
                {hasLiveOracle ? `${oracle.spreadPct.toFixed(3)}%` : "--"}
                <span className="text-ink-300 mx-1.5">&middot;</span>
                {hasLiveOracle ? formatUsdSpreadAbsolute(spreadDollar) : "--"}
              </span>
            </div>
          </div>
        </div>

        <div className="card-surface p-4 sm:p-5 flex flex-col opacity-0 animate-fade-up-1">
          <span className="text-xs font-medium uppercase tracking-wider text-ink-900 mb-3">Liquidity</span>
          <div className="flex items-start gap-3">
            <div className="flex flex-col flex-1">
              <span className="text-[18px] sm:text-[22px] font-semibold leading-none text-ink-900" style={{ letterSpacing: "-0.4px" }}>
                {hasLiveOracle ? liqWord : "--"}
              </span>
              <span className="text-[13px] text-ink-500 mt-2 tabular">
                {hasLiveOracle ? `${formatUsdSpreadAbsolute(spreadDollar)} spread` : "--"}
              </span>
              <span className="text-xs font-medium text-ink-400 mt-1.5">
                {hasLiveOracle ? liqSub : "--"}
              </span>
            </div>
            <LiquidityTank spreadPct={hasLiveOracle ? oracle.spreadPct : 0} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TradingSessionClocks
          assetClass={assetClass}
          marketSession={oracle.marketSession}
          isStale={oracle.isStale}
          hasLiveOracle={hasLiveOracle}
        />

        <div
          className="card-surface p-4 sm:p-5 md:p-6 flex flex-col opacity-0 animate-fade-up-2 relative overflow-hidden"
          style={{ background: "linear-gradient(160deg, #F5F2FB 0%, #EDE5F9 40%, #E2D6F4 100%)" }}
        >
          <span className="text-xs font-medium uppercase tracking-wider text-ink-900 mb-3">Oracle Signal</span>
          <span className="text-[18px] sm:text-[22px] font-semibold leading-none" style={{ color: hasLiveOracle ? sigColor : "var(--ink-400)", letterSpacing: "-0.4px" }}>
            {hasLiveOracle ? signal.label : "--"}
          </span>
          <span className="text-[13px] font-medium text-ink-500 mt-2.5 leading-relaxed">
            {hasLiveOracle ? signal.description : "--"}
          </span>
          <div className="mt-auto pt-4">
            <Link
              href="/portal"
              prefetch
              className="text-[13px] font-medium tracking-wide text-black transition-opacity duration-150 hover:opacity-80"
              onClick={() => {
                void readingAudio?.beginAmbientFromReadingNav();
              }}
            >
              Ask the oracle for a full reading {"\u2192"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

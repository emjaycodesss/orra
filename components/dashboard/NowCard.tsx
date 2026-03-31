"use client";

import { useMemo } from "react";
import { useConfidenceHistory } from "@/hooks/useConfidenceHistory";
import { usePublisherParticipationBands } from "@/hooks/usePublisherParticipationBands";
import type { TimeRange } from "@/hooks/useSparkline";
import Image from "next/image";
import type { OracleState, PythStreamData } from "@/lib/oracleState";
import { formatPriceAdaptive } from "@/lib/format-price";

interface Props {
  oracle: OracleState;
  assetName: string;
  periodOpen: number;
  logoUrl: string | null;
  liveData: PythStreamData | null;
  assetSymbol: string;
  timeRange: TimeRange;
  fallbackPrice: number;
  hasLiveOracle: boolean;
}

function getClarityLabel(confPct: number): "tight" | "moderate" | "wide" | "extreme" {
  if (confPct < 0.5) return "tight";
  if (confPct < 1) return "moderate";
  if (confPct < 2) return "wide";
  return "extreme";
}

function getDriftLabel(current: number, ema: number): "widening" | "narrowing" | "stable" {
  const drift = current - ema;
  const threshold = Math.max(Math.abs(ema) * 0.08, 0.01);
  if (Math.abs(drift) <= threshold) return "stable";
  return drift > 0 ? "widening" : "narrowing";
}

export function NowCard({
  oracle,
  assetName,
  periodOpen,
  logoUrl,
  liveData,
  assetSymbol,
  timeRange,
  fallbackPrice,
  hasLiveOracle,
}: Props) {
  const displayPrice = oracle.price > 0 ? oracle.price : fallbackPrice;

  const rawChange = periodOpen > 0
    ? ((displayPrice - periodOpen) / periodOpen) * 100
    : 0;
  const changePct = Object.is(rawChange, -0) ? 0 : rawChange;
  const changePositive = changePct >= 0;
  const decimals = Math.abs(changePct) < 0.01 && changePct !== 0 ? 4 : Math.abs(changePct) < 0.1 ? 3 : 2;
  const confidenceHours = timeRange === "daily" ? 24 : timeRange === "weekly" ? 168 : 720;
  const { history: confidenceHistory } = useConfidenceHistory(liveData, assetSymbol, confidenceHours);

  const ciWindow = useMemo(() => confidenceHistory.slice(-48), [confidenceHistory]);
  const currentCiPct = ciWindow[ciWindow.length - 1]?.conf ?? oracle.confidencePct;
  const ciClarity = getClarityLabel(currentCiPct);

  const ciEma = useMemo(() => {
    if (ciWindow.length === 0) return currentCiPct;
    const alpha = 2 / (12 + 1);
    let ema = ciWindow[0].conf;
    for (let i = 1; i < ciWindow.length; i++) ema = alpha * ciWindow[i].conf + (1 - alpha) * ema;
    return ema;
  }, [ciWindow, currentCiPct]);
  const ciDrift = getDriftLabel(currentCiPct, ciEma);
  const participationLabel = usePublisherParticipationBands(
    liveData,
    oracle.publisherCount,
    hasLiveOracle
  );

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5 md:p-6 opacity-0 animate-fade-up"
      style={{
        borderRadius: 16,
        background: "radial-gradient(circle 280px at 0% 0%, #3B2D50, #1A1225)",
        boxShadow: "3px 3px 6px rgba(26, 18, 37, 0.25), 0 2px 4px rgba(26, 18, 37, 0.15), inset 1px 1px 2px rgba(167, 139, 250, 0.1), inset -1px -1px 2px rgba(26, 18, 37, 0.1)",
      }}
      >
        <div
          className="absolute pointer-events-none w-[160px] h-[35px] sm:w-[220px] sm:h-[45px]"
          style={{
            borderRadius: 100,
            backgroundColor: "#A78BFA",
            opacity: 0.15,
            boxShadow: "0 0 40px #A78BFA",
            filter: "blur(10px)",
            transformOrigin: "10%",
            top: 0,
            left: 0,
            transform: "rotate(40deg)",
          }}
        />

        <div className="absolute pointer-events-none top-3.5 sm:top-[18px] left-0 w-full h-px" style={{ background: "linear-gradient(90deg, #A78BFA15 30%, transparent 70%)" }} />
        <div className="absolute pointer-events-none bottom-3.5 sm:bottom-[18px] left-0 w-full h-px" style={{ background: "linear-gradient(90deg, transparent 30%, #2D264030 70%)" }} />
        <div className="absolute pointer-events-none left-3.5 sm:left-[18px] top-0 w-px h-full" style={{ background: "linear-gradient(180deg, #A78BFA15 30%, transparent 70%)" }} />
        <div className="absolute pointer-events-none right-3.5 sm:right-[18px] top-0 w-px h-full" style={{ background: "linear-gradient(180deg, transparent 30%, #2D264030 70%)" }} />

        <div className="now-card-line" aria-hidden />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="mb-3 sm:mb-4 md:mb-5 flex shrink-0 items-center gap-2.5">
            {logoUrl && (
              <Image
                src={logoUrl}
                alt=""
                width={28}
                height={28}
                className="w-7 h-7 rounded-full"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.4), 0 0 0 2px rgba(167,139,250,0.2)" }}
              />
            )}
            <span className="text-base font-bold uppercase tracking-wide text-white/90">{assetName}</span>
          </div>

          <div className="shrink-0">
            <span
              className="block text-[32px] sm:text-[36px] md:text-[40px] font-semibold tabular leading-none"
              style={{
                letterSpacing: "-0.4px",
                background: "linear-gradient(45deg, #A78BFA 0%, #fff 50%, #A78BFA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {formatPriceAdaptive(displayPrice)}
            </span>
            <div className="flex items-center gap-2 mt-2.5">
              <span
                className="text-sm font-semibold tabular"
                style={{ color: changePositive ? "#86EFAC" : "#FCA5A5" }}
              >
                {changePositive ? "+" : ""}{changePct.toFixed(decimals)}%
              </span>
              <span className="text-[13px] text-white/40">from open</span>
            </div>
          </div>

          <div className="min-h-3 flex-1" aria-hidden />
          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-white/45 uppercase tracking-wider">CI</span>
              <span className="text-white/85 tabular">{hasLiveOracle ? `±${currentCiPct.toFixed(3)}%` : "--"}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-white/45 uppercase tracking-wider">Signal clarity</span>
              <span className="text-white/75 capitalize">{hasLiveOracle ? ciClarity : "--"}</span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-white/45 uppercase tracking-wider">Confidence drift</span>
              <span className="text-white/75 capitalize">{hasLiveOracle ? ciDrift : "--"}</span>
            </div>
          </div>
          <div className="min-h-3 flex-1" aria-hidden />

          <div className="shrink-0 pt-4">
            <div className="flex items-center justify-between mb-2.5 text-[12px]">
              <span className="text-xs font-medium uppercase tracking-wider text-white/50">Publishers</span>
              <span className="text-white/85 tabular">
                {hasLiveOracle && oracle.publisherCount > 0 ? `${oracle.publisherCount} active` : "--"}
              </span>
            </div>
            <div className="flex flex-wrap gap-[5px]">
              {Array.from({ length: 20 }, (_, i) => {
                const active = hasLiveOracle && i < oracle.publisherCount;
                return (
                  <div
                    key={i}
                    className="w-[7px] h-[7px] rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: active ? "#A78BFA" : "rgba(255,255,255,0.08)",
                      boxShadow: active ? "0 0 6px rgba(167,139,250,0.5)" : "none",
                      opacity: active ? 1 : 0.4,
                    }}
                  />
                );
              })}
            </div>
            <span className="text-[11px] text-white/30 mt-2 block">{participationLabel}</span>
          </div>
        </div>
      </div>
  );
}

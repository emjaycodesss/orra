"use client";

import Link from "next/link";
import type { WeatherState } from "@/lib/weather";
import type { SparklinePoint, TimeRange } from "@/hooks/useSparkline";

interface Props {
  weather: WeatherState;
  sparklineData: SparklinePoint[];
  periodOpen: number;
  timeRange: TimeRange;
}

function fmt(price: number): string {
  if (price === 0) return "--";
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(6);
}

function fmtDollar(price: number): string {
  if (price === 0) return "$0";
  if (price >= 1) return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

const RANGE_LABELS: Record<TimeRange, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
};

// --- Oracle Signal ---

function computeOracleSignal(weather: WeatherState, periodChangePct: number): { label: string; description: string; glow: string } {
  const trendDir = periodChangePct > 0.1 ? "up" : periodChangePct < -0.1 ? "down" : "flat";
  const trendStrength = Math.abs(periodChangePct);
  const trendWord = trendDir === "up"
    ? (trendStrength > 2 ? "Strong uptrend" : "Trending up")
    : trendDir === "down"
      ? (trendStrength > 2 ? "Strong downtrend" : "Trending down")
      : "Sideways";

  const clarity = weather.confidencePct < 0.5 ? "clear" : weather.confidencePct < 1 ? "hazy" : "foggy";
  const liquidity = weather.spreadPct < 0.02 ? "deep" : weather.spreadPct < 0.1 ? "normal" : "thin";

  let s = 50;
  if (periodChangePct > 2) s += 20;
  else if (periodChangePct > 0.5) s += 12;
  else if (periodChangePct > 0) s += 5;
  else if (periodChangePct > -0.5) s -= 5;
  else if (periodChangePct > -2) s -= 12;
  else s -= 20;
  if (weather.confidencePct < 0.5) s += 8; else if (weather.confidencePct >= 2) s -= 10;
  if (weather.spreadPct < 0.02) s += 7; else if (weather.spreadPct >= 0.5) s -= 10;
  const score = Math.max(0, Math.min(100, s));

  if (weather.fogMode || weather.isStale) {
    return { label: "Turbulent", description: `${weather.fogMode ? "Fog obscures the signal" : "Stale data"}, proceed with care`, glow: "rgba(220, 38, 38, 0.05)" };
  }
  if (score >= 70 && clarity === "clear") {
    return { label: "Favorable", description: `${trendWord}, clear signal, ${liquidity} market`, glow: "rgba(22, 163, 74, 0.05)" };
  }
  if (score >= 50) {
    return { label: "Cautious", description: `${trendWord}, ${clarity} visibility, ${liquidity} liquidity`, glow: "rgba(124, 58, 237, 0.05)" };
  }
  if (score < 30) {
    return { label: "Unfavorable", description: `${trendWord}, ${clarity} visibility, ${liquidity} liquidity`, glow: "rgba(220, 38, 38, 0.04)" };
  }
  return { label: "Uncertain", description: `${trendWord}, ${clarity} visibility, ${liquidity} liquidity`, glow: "rgba(107, 90, 130, 0.04)" };
}

function signalColor(label: string): string {
  if (label === "Favorable") return "var(--clear)";
  if (label === "Cautious") return "var(--fog)";
  if (label === "Turbulent" || label === "Unfavorable") return "var(--storm)";
  return "var(--ink-500)";
}

// --- Mini Sparkline ---

// --- Liquidity Tank ---

function LiquidityTank({ spreadPct }: { spreadPct: number }) {
  const depth = spreadPct < 0.02 ? 90 : spreadPct < 0.05 ? 75 : spreadPct < 0.1 ? 55 : spreadPct < 0.3 ? 35 : spreadPct < 0.5 ? 20 : 8;
  const w = 44;
  const h = 72;
  const wall = 2.5;
  const iW = w - wall * 2;
  const iH = h - wall * 2 - 18;
  const fH = (depth / 100) * iH;
  const fY = wall + 4 + iH - fH;

  const deep = depth >= 70;
  const mid = depth >= 45;
  const topColor = deep ? "#A78BFA" : mid ? "#A78BFA" : depth >= 25 ? "#FBBF24" : "#F87171";
  const botColor = deep ? "#6D28D9" : mid ? "#7C3AED" : depth >= 25 ? "#D97706" : "#DC2626";
  const glassTop = deep ? "#EDE9FE" : mid ? "#EDE9FE" : depth >= 25 ? "#FEF3C7" : "#FEE2E2";

  const waveA = 2.5;
  const wD1 = `M ${wall} ${fY} Q ${wall + iW * 0.25} ${fY - waveA} ${wall + iW * 0.5} ${fY} Q ${wall + iW * 0.75} ${fY + waveA} ${wall + iW} ${fY} L ${wall + iW} ${wall + 4 + iH} L ${wall} ${wall + 4 + iH} Z`;
  const wD2 = `M ${wall} ${fY} Q ${wall + iW * 0.25} ${fY + waveA} ${wall + iW * 0.5} ${fY} Q ${wall + iW * 0.75} ${fY - waveA} ${wall + iW} ${fY} L ${wall + iW} ${wall + 4 + iH} L ${wall} ${wall + 4 + iH} Z`;

  const uid = `tank-${depth}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block shrink-0">
      <defs>
        <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={topColor} stopOpacity="0.6" />
          <stop offset="100%" stopColor={botColor} stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={glassTop} stopOpacity="0.5" />
          <stop offset="100%" stopColor={glassTop} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-tank`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--surface-4)" stopOpacity="0.8" />
          <stop offset="50%" stopColor="var(--surface-3)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--surface-4)" stopOpacity="0.8" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <rect x={wall} y={wall + 4} width={iW} height={iH} rx="5" />
        </clipPath>
        <filter id={`${uid}-glow`}>
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Tank body — 3D glass effect */}
      <rect x={wall} y={wall + 4} width={iW} height={iH} rx="5" fill="var(--surface-2)" />
      <rect x={wall} y={wall + 4} width={iW} height={iH} rx="5" fill={`url(#${uid}-tank)`} />

      {/* Water */}
      <g clipPath={`url(#${uid}-clip)`}>
        <path d={wD1} fill={`url(#${uid}-water)`} className="transition-all duration-700 ease-out">
          <animate attributeName="d" values={`${wD1};${wD2};${wD1}`} dur="2.5s" repeatCount="indefinite" />
        </path>
        {/* Water surface highlight */}
        <line x1={wall + 3} y1={fY + 1} x2={wall + iW * 0.4} y2={fY + 1}
          stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.15;0.3" dur="2.5s" repeatCount="indefinite" />
        </line>
        {/* Bubble */}
        {depth > 20 && (
          <circle cx={wall + iW * 0.6} cy={fY + fH * 0.5} r="1.5" fill="white" opacity="0.25">
            <animate attributeName="cy" values={`${fY + fH * 0.7};${fY + 3};${fY + fH * 0.7}`} dur="4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0.1;0.25" dur="4s" repeatCount="indefinite" />
          </circle>
        )}
        {depth > 40 && (
          <circle cx={wall + iW * 0.3} cy={fY + fH * 0.6} r="1" fill="white" opacity="0.2">
            <animate attributeName="cy" values={`${fY + fH * 0.6};${fY + 5};${fY + fH * 0.6}`} dur="5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;0.08;0.2" dur="5s" repeatCount="indefinite" />
          </circle>
        )}
      </g>

      {/* Glass reflection overlay */}
      <rect x={wall + 2} y={wall + 6} width={iW * 0.3} height={iH - 4} rx="3" fill={`url(#${uid}-glass)`} />

      {/* Tank border — 3D raised */}
      <rect x={wall} y={wall + 4} width={iW} height={iH} rx="5" fill="none" stroke="var(--surface-4)" strokeWidth="1.5" />

      {/* Depth markers */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <line key={pct}
          x1={wall + iW - 4} y1={wall + 4 + iH * (1 - pct)} x2={wall + iW - 1} y2={wall + 4 + iH * (1 - pct)}
          stroke="var(--surface-4)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      ))}

      {/* Percentage label */}
      <text x={w / 2} y={wall + 4 + iH + 12} textAnchor="middle" fontSize="10" fontFamily="Manrope" fontWeight="600" fill="var(--ink-400)">
        {depth}%
      </text>
    </svg>
  );
}

// --- Clarity Sky ---

function ClaritySky({ confidencePct }: { confidencePct: number }) {
  // crystal clear < 0.3, clear < 0.5, hazy < 1.5, foggy >= 1.5
  const level = confidencePct < 0.3 ? 0 : confidencePct < 0.5 ? 1 : confidencePct < 1.5 ? 2 : 3;
  const vw = 80;
  const vh = 40;

  return (
    <svg width={120} height={60} viewBox={`0 0 ${vw} ${vh}`} className="block shrink-0">
      <defs>
        {/* Sun radial gradient for 3D sphere look */}
        <radialGradient id="sunGrad" cx="0.35" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="#DDD6FE" />
          <stop offset="50%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#7C3AED" />
        </radialGradient>
        <filter id="sunGlow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Cloud gradients for 3D puffy look */}
        <radialGradient id="cloud1Grad" cx="0.4" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#EDE9FE" />
          <stop offset="60%" stopColor="#C4B5FD" />
          <stop offset="100%" stopColor="#A78BFA" />
        </radialGradient>
        <radialGradient id="cloud2Grad" cx="0.4" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#DDD6FE" />
          <stop offset="60%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </radialGradient>
        <radialGradient id="cloud3Grad" cx="0.4" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="#C4B5FD" />
          <stop offset="60%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6D28D9" />
        </radialGradient>
        <filter id="cloudShadow">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1" floodColor="#6D28D9" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Sun */}
      <circle cx="16" cy="16" r="7" fill="url(#sunGrad)" filter="url(#sunGlow)" opacity={level === 0 ? 1 : level === 1 ? 0.8 : level === 2 ? 0.3 : 0}>
        {level < 2 && <animate attributeName="r" values="7;7.5;7" dur="3s" repeatCount="indefinite" />}
      </circle>
      {/* Sun rays */}
      {level < 2 && [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1={16 + Math.cos((angle * Math.PI) / 180) * 9.5}
          y1={16 + Math.sin((angle * Math.PI) / 180) * 9.5}
          x2={16 + Math.cos((angle * Math.PI) / 180) * 12}
          y2={16 + Math.sin((angle * Math.PI) / 180) * 12}
          stroke="#A78BFA"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity={level === 0 ? 0.6 : 0.3}
        >
          <animate attributeName="opacity" values={`${level === 0 ? 0.6 : 0.3};${level === 0 ? 0.25 : 0.15};${level === 0 ? 0.6 : 0.3}`} dur="3s" repeatCount="indefinite" />
        </line>
      ))}

      {/* Cloud 1 */}
      {level >= 1 && (
        <g opacity={level === 1 ? 0.6 : level === 2 ? 0.8 : 0.95} filter="url(#cloudShadow)">
          <animateTransform attributeName="transform" type="translate" values="0,0;6,0;0,0" dur="8s" repeatCount="indefinite" />
          {/* Bottom shadow layer */}
          <ellipse cx="42" cy="17" rx="10" ry="4" fill="#8B5CF6" opacity="0.2" />
          {/* Main body */}
          <ellipse cx="42" cy="14" rx="10" ry="5" fill="url(#cloud1Grad)" />
          <ellipse cx="38" cy="16" rx="7" ry="4" fill="url(#cloud1Grad)" />
          <ellipse cx="47" cy="16" rx="6" ry="3.5" fill="url(#cloud1Grad)" />
          {/* Highlight */}
          <ellipse cx="40" cy="12" rx="5" ry="2.5" fill="#EDE9FE" opacity="0.5" />
        </g>
      )}

      {/* Cloud 2 */}
      {level >= 2 && (
        <g opacity={level === 2 ? 0.7 : 0.9} filter="url(#cloudShadow)">
          <animateTransform attributeName="transform" type="translate" values="0,0;-5,0;0,0" dur="10s" repeatCount="indefinite" />
          <ellipse cx="62" cy="25" rx="9" ry="3.5" fill="#7C3AED" opacity="0.15" />
          <ellipse cx="62" cy="22" rx="9" ry="4.5" fill="url(#cloud2Grad)" />
          <ellipse cx="57" cy="24" rx="6" ry="3.5" fill="url(#cloud2Grad)" />
          <ellipse cx="67" cy="24" rx="5.5" ry="3" fill="url(#cloud2Grad)" />
          <ellipse cx="60" cy="20" rx="4.5" ry="2" fill="#DDD6FE" opacity="0.45" />
        </g>
      )}

      {/* Cloud 3 */}
      {level >= 3 && (
        <g opacity="0.85" filter="url(#cloudShadow)">
          <animateTransform attributeName="transform" type="translate" values="0,0;4,0;0,0" dur="6s" repeatCount="indefinite" />
          <ellipse cx="30" cy="31" rx="14" ry="4" fill="#6D28D9" opacity="0.15" />
          <ellipse cx="30" cy="28" rx="14" ry="5.5" fill="url(#cloud3Grad)" />
          <ellipse cx="22" cy="30" rx="9" ry="4" fill="url(#cloud3Grad)" />
          <ellipse cx="40" cy="30" rx="8" ry="3.5" fill="url(#cloud3Grad)" />
          <ellipse cx="28" cy="26" rx="6" ry="2.5" fill="#C4B5FD" opacity="0.4" />
        </g>
      )}

      {/* Fog layer */}
      {level >= 3 && (
        <rect x="0" y="32" width={vw} height="8" fill="#8B5CF6" opacity="0.15" rx="2">
          <animate attributeName="opacity" values="0.15;0.08;0.15" dur="4s" repeatCount="indefinite" />
        </rect>
      )}
    </svg>
  );
}

// --- Main Component ---

export function HighlightsGrid({ weather, sparklineData, periodOpen, timeRange }: Props) {
  const latestClose = sparklineData.length > 0 ? sparklineData[sparklineData.length - 1].close : 0;
  const currentPrice = weather.price > 0 ? weather.price : latestClose;
  const changePct = periodOpen > 0 ? ((currentPrice - periodOpen) / periodOpen) * 100 : 0;
  const changeColor = changePct > 0.01 ? "var(--clear)" : changePct < -0.01 ? "var(--storm)" : "var(--ink-400)";
  const trendDir = changePct > 0.1 ? "Trending up" : changePct < -0.1 ? "Trending down" : "Sideways";

  const clarityWord = weather.confidencePct < 0.3 ? "Crystal clear" : weather.confidencePct < 0.5 ? "Clear" : weather.confidencePct < 1.5 ? "Hazy" : "Foggy";
  const clarityCol = weather.confidencePct < 0.3 ? "var(--clear)" : weather.confidencePct < 0.5 ? "var(--clear)" : weather.confidencePct < 1.5 ? "var(--fog)" : "var(--storm)";
  const stormArrow = weather.stormTrend === "intensifying" ? "\u2191" : weather.stormTrend === "clearing" ? "\u2193" : "\u2192";
  const stormLabel = weather.stormTrend === "intensifying" ? "uncertainty rising" : weather.stormTrend === "clearing" ? "uncertainty easing" : "stable";

  const liqWord = weather.spreadPct < 0.02 ? "Deep" : weather.spreadPct < 0.1 ? "Normal" : weather.spreadPct < 0.5 ? "Thin" : "Dangerous";
  const liqSub = weather.spreadPct < 0.02 ? "Easy to enter and exit" : weather.spreadPct < 0.1 ? "Normal conditions" : weather.spreadPct < 0.5 ? "Expect slippage" : "High slippage risk";
  const spreadDollar = weather.ask - weather.bid;

  const signal = computeOracleSignal(weather, changePct);
  const sigColor = signalColor(signal.label);

  const closes = sparklineData.map((d) => d.close);
  const periodHigh = closes.length > 0 ? Math.max(...closes) : 0;
  const periodLow = closes.length > 0 ? Math.min(...closes) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {/* Card 1: Trend */}
        <div className="card-surface p-4 flex flex-col opacity-0 animate-fade-up-1">
          <span className="text-[10px] font-normal uppercase text-ink-900 mb-2">Trend</span>
          <span className="text-[26px] font-semibold tabular leading-none" style={{ color: changeColor, letterSpacing: "-0.4px" }}>
            {changePct > 0 ? "+" : ""}{changePct.toFixed(2)}%
          </span>
          <span className="text-[10px] font-medium text-ink-400 mt-1 mb-3">{trendDir} {RANGE_LABELS[timeRange]}</span>
          <div className="mt-auto">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium text-ink-400">Low: <span className="tabular text-ink-500">{fmt(periodLow)}</span></span>
              <span className="text-[10px] font-medium text-ink-400">High: <span className="tabular text-ink-500">{fmt(periodHigh)}</span></span>
            </div>
            <div className="h-2 rounded-full overflow-hidden relative" style={{ backgroundColor: "rgba(124, 58, 237, 0.12)" }}>
              {periodHigh > periodLow && (
                <div
                  className="absolute top-0 h-full w-2.5 rounded-full"
                  style={{
                    backgroundColor: "var(--accent)",
                    left: `${Math.min(100, Math.max(0, ((currentPrice - periodLow) / (periodHigh - periodLow)) * 100))}%`,
                    transform: "translateX(-50%)",
                    boxShadow: "0 0 6px rgba(124, 58, 237, 0.5)",
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Clarity */}
        <div className="card-surface p-4 flex flex-col opacity-0 animate-fade-up-1 overflow-hidden">
          <span className="text-[10px] font-normal uppercase text-ink-900 mb-2">Clarity</span>
          <div className="flex items-center w-full">
            <div className="flex flex-col min-w-0">
              <span className="text-[18px] font-semibold leading-none" style={{ color: clarityCol, letterSpacing: "-0.4px" }}>
                {clarityWord}
              </span>
              <span className="text-[11px] text-ink-500 mt-1 tabular">
                {"\u00B1"}{fmtDollar(weather.confidence)}
              </span>
              <span className="text-[10px] font-medium text-ink-400 mt-1">
                {stormArrow} {stormLabel}
              </span>
            </div>
            <div className="ml-auto">
              <ClaritySky confidencePct={weather.confidencePct} />
            </div>
          </div>
        </div>

        {/* Card 3: Liquidity */}
        <div className="card-surface p-4 flex flex-col opacity-0 animate-fade-up-1">
          <span className="text-[10px] font-normal uppercase text-ink-900 mb-2">Liquidity</span>
          <div className="flex items-start gap-3">
            <div className="flex flex-col flex-1">
              <span className="text-[22px] font-semibold leading-none text-ink-900" style={{ letterSpacing: "-0.4px" }}>{liqWord}</span>
              <span className="text-[11px] text-ink-500 mt-1.5 tabular">{fmtDollar(spreadDollar)} spread</span>
              <span className="text-[10px] font-medium text-ink-400 mt-1">{liqSub}</span>
            </div>
            <LiquidityTank spreadPct={weather.spreadPct} />
          </div>
        </div>
      </div>

      {/* Oracle Signal */}
      <div
        className="card-surface p-5 flex flex-col opacity-0 animate-fade-up-2 relative overflow-hidden"
        style={{ boxShadow: `var(--shadow-3d), inset 0 0 80px ${signal.glow}` }}
      >
        <span className="text-[10px] font-normal uppercase text-ink-900 mb-3">Oracle Signal</span>
        <span className="text-[26px] font-semibold leading-none" style={{ color: sigColor, letterSpacing: "-0.4px" }}>
          {signal.label}
        </span>
        <span className="text-[12px] font-medium text-ink-500 mt-2 leading-relaxed">
          {signal.description}
        </span>
        <div className="mt-auto pt-4">
          <Link href="/reading"
            className="text-[11px] font-medium tracking-wide transition-colors duration-150 hover:text-ink-900"
            style={{ color: sigColor }}>
            Ask the oracle for a full reading {"\u2192"}
          </Link>
        </div>
      </div>
    </div>
  );
}

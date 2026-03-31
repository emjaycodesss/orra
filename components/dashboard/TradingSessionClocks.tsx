"use client";

import { useMemo } from "react";
import type { MarketSession } from "@/lib/oracleState";
import { getMarketStatus } from "@/lib/market-hours";
import { useWallClockMs } from "@/hooks/useWallClock";

export type TradingAssetClass = "crypto" | "equity" | "fx" | "metal" | "commodity";

interface ClockCity {
  city: string;
  timezone: string;
}

const CITIES: ClockCity[] = [
  { city: "Tokyo", timezone: "Asia/Tokyo" },
  { city: "London", timezone: "Europe/London" },
  { city: "New York", timezone: "America/New_York" },
];

function getLocalTime(now: Date, tz: string): { h: number; m: number; s: number; frac: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const h = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find(p => p.type === "minute")?.value ?? 0);
  const s = Number(parts.find(p => p.type === "second")?.value ?? 0);
  return { h, m, s, frac: h + m / 60 + s / 3600 };
}

function getCryptoSessionInfo(utcFrac: number): { tokyo: boolean; london: boolean; ny: boolean; overlap: boolean } {
  const asian  = utcFrac >= 0 && utcFrac < 9;
  const london = utcFrac >= 7 && utcFrac < 16;
  const us     = utcFrac >= 12 && utcFrac < 21;
  const overlap = london && us;
  return { tokyo: asian, london, ny: us, overlap };
}

function getCryptoLabel(city: string, info: ReturnType<typeof getCryptoSessionInfo>): string {
  if (city === "Tokyo")    return info.tokyo  ? "Open"  : "Closed";
  if (city === "London")   return info.london ? "Open"  : "Closed";
  if (city === "New York") return info.ny     ? "Open"  : "Closed";
  return "Closed";
}

function isCryptoActive(city: string, info: ReturnType<typeof getCryptoSessionInfo>): boolean {
  if (city === "Tokyo")    return info.tokyo;
  if (city === "London")   return info.london;
  if (city === "New York") return info.ny;
  return false;
}

function getLocalWeekday(now: Date, tz: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

function getNonCryptoInfo(now: Date, marketSession: MarketSession): { tokyo: boolean; london: boolean; ny: boolean; tokyoLabel: string; londonLabel: string; nyLabel: string } {
  const tokyo = getLocalTime(now, "Asia/Tokyo");
  const london = getLocalTime(now, "Europe/London");
  const ny = getLocalTime(now, "America/New_York");
  const tokyoWeekday = getLocalWeekday(now, "Asia/Tokyo");
  const londonWeekday = getLocalWeekday(now, "Europe/London");
  const nyWeekday = getLocalWeekday(now, "America/New_York");

  const tokyoIsWeekday = tokyoWeekday >= 1 && tokyoWeekday <= 5;
  const londonIsWeekday = londonWeekday >= 1 && londonWeekday <= 5;
  const nyIsWeekday = nyWeekday >= 1 && nyWeekday <= 5;

  const tokyoOpenSession =
    (tokyo.frac >= 9 && tokyo.frac < 11.5) || (tokyo.frac >= 12.5 && tokyo.frac < 15);
  const tokyoLunchBreak = tokyo.frac >= 11.5 && tokyo.frac < 12.5;
  const tokyoOpen = tokyoIsWeekday && tokyoOpenSession;

  const londonOpen = londonIsWeekday && london.frac >= 8 && london.frac < 16.5;

  let nyActive = false;
  let nyLabel = "Closed";
  if (!nyIsWeekday || marketSession === "closed") {
    nyActive = false;
    nyLabel = "Closed";
  } else if (marketSession === "regular") {
    nyActive = true;
    nyLabel = "Open";
  } else if (marketSession === "preMarket") {
    nyActive = true;
    nyLabel = "Pre-Market";
  } else if (marketSession === "postMarket" || marketSession === "overNight") {
    nyActive = true;
    nyLabel = "After Hours";
  }

  return {
    tokyo: tokyoOpen,
    london: londonOpen,
    ny: nyActive,
    tokyoLabel: tokyoOpen ? "Open" : tokyoIsWeekday && tokyoLunchBreak ? "Lunch Break" : "Closed",
    londonLabel: londonOpen ? "Open" : "Closed",
    nyLabel,
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function AnalogClock({ tz, active, now, size = 72 }: { tz: string; active: boolean; now: Date; size?: number }) {
  const { h, m, s } = useMemo(() => getLocalTime(now, tz), [now, tz]);

  const hAngle = (h % 12) * 30 + m * 0.5 + s * (0.5 / 60);
  const mAngle = m * 6 + s * 0.1;
  const sAngle = s * 6;

  const r = size / 2;
  const cx = r;
  const cy = r;

  const handEnd = (angle: number, len: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * len, y: cy + Math.sin(rad) * len };
  };

  const hEnd = handEnd(hAngle, r * 0.45);
  const mEnd = handEnd(mAngle, r * 0.62);
  const sEnd = handEnd(sAngle, r * 0.7);

  const opacity = active ? 1 : 0.4;
  const faceColor = active ? "var(--surface-2)" : "var(--surface-3)";
  const handColor = active ? "var(--ink-700)" : "var(--ink-300)";
  const accentColor = active ? "var(--accent)" : "var(--ink-300)";
  const rimColor = active ? "var(--accent)" : "var(--surface-4)";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ opacity }}>
      <circle cx={cx} cy={cy} r={r - 2} fill={faceColor}
        style={{ filter: active ? "none" : "saturate(0.4)" }}
      />
      <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke={rimColor} strokeWidth="2" opacity={active ? 0.6 : 0.3} />
      <circle cx={cx} cy={cy} r={r - 3} fill="none" stroke="rgba(26,18,37,0.06)" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />

      {Array.from({ length: 12 }, (_, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180;
        const outer = r - 5;
        const inner = i % 3 === 0 ? r - 10 : r - 8;
        return (
          <line key={i}
            x1={cx + Math.cos(rad) * inner} y1={cy + Math.sin(rad) * inner}
            x2={cx + Math.cos(rad) * outer} y2={cy + Math.sin(rad) * outer}
            stroke={handColor} strokeWidth={i % 3 === 0 ? 1.5 : 0.75} strokeLinecap="round"
          />
        );
      })}

      <line x1={cx} y1={cy} x2={hEnd.x} y2={hEnd.y} stroke={handColor} strokeWidth="2.5" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={mEnd.x} y2={mEnd.y} stroke={handColor} strokeWidth="1.5" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={sEnd.x} y2={sEnd.y} stroke={accentColor} strokeWidth="0.75" strokeLinecap="round" />

      <circle cx={cx} cy={cy} r="2" fill={accentColor} />
      <circle cx={cx} cy={cy} r="1" fill={faceColor} />
    </svg>
  );
}

interface Props {
  assetClass: TradingAssetClass;
  marketSession: MarketSession;
  isStale: boolean;
  hasLiveOracle: boolean;
}

export function TradingSessionClocks({ assetClass, marketSession, isStale, hasLiveOracle }: Props) {
  const nowMs = useWallClockMs();
  const now = new Date(nowMs);

  const utcTime = getLocalTime(now, "UTC");
  const cryptoInfo = getCryptoSessionInfo(utcTime.frac);
  const nonCryptoInfo = getNonCryptoInfo(now, marketSession);
  const isCrypto = assetClass === "crypto";

  const isSingleMarket = assetClass === "equity" || assetClass === "metal" || assetClass === "commodity";
  if (isSingleMarket) {
    const nyLocal = getLocalTime(now, "America/New_York");
    const nyTime = `${pad2(nyLocal.h)}:${pad2(nyLocal.m)}:${pad2(nyLocal.s)}`;
    const exchangeLabel = assetClass === "equity" ? "NYSE / NASDAQ" : "CME Globex";
    const marketStatus = getMarketStatus(assetClass, now);

    const sessionLabel = hasLiveOracle ? marketStatus.label : "--";
    const active = marketStatus.open;

    return (
      <div className="card-surface p-4 sm:p-5 flex flex-col items-center opacity-0 animate-fade-up-2">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-900 mb-4">Trading Sessions</span>
        <span className="sm:hidden"><AnalogClock tz="America/New_York" active={active} now={now} size={72} /></span>
        <span className="hidden sm:block"><AnalogClock tz="America/New_York" active={active} now={now} size={96} /></span>
        <span className="mt-2 text-[11px] font-semibold text-ink-900">{exchangeLabel}</span>
        <span className="text-[10px] tabular font-medium text-ink-700">{nyTime} ET</span>
        <span
          className="text-[10px] font-semibold mt-0.5"
          style={{ color: active ? "var(--accent)" : "var(--ink-400)" }}
        >
          {sessionLabel}
        </span>
        {isStale && hasLiveOracle && (
          <div className="mt-2 text-center">
            <span className="text-[10px] font-medium text-ink-400">
              Oracle feed is currently quiet
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card-surface p-4 sm:p-5 flex flex-col opacity-0 animate-fade-up-2">
      <span className="text-xs font-medium uppercase tracking-wider text-ink-900 mb-3 sm:mb-4">Trading Sessions</span>

      <div className="flex items-start justify-between">
        {CITIES.map((c) => {
          let active: boolean;
          let sessionLabel: string;

          if (isCrypto || assetClass === "fx") {
            active = isCryptoActive(c.city, cryptoInfo);
            sessionLabel = getCryptoLabel(c.city, cryptoInfo);
          } else {
            if (c.city === "Tokyo")       { active = nonCryptoInfo.tokyo;  sessionLabel = nonCryptoInfo.tokyoLabel; }
            else if (c.city === "London") { active = nonCryptoInfo.london; sessionLabel = nonCryptoInfo.londonLabel; }
            else                          { active = nonCryptoInfo.ny;     sessionLabel = nonCryptoInfo.nyLabel; }
            if (isStale && active) {
              sessionLabel = "Window Open";
            }
          }

          const local = getLocalTime(now, c.timezone);
          const timeStr = `${pad2(local.h)}:${pad2(local.m)}:${pad2(local.s)}`;

          return (
            <div key={c.city} className="flex flex-col items-center gap-0.5" style={{ flex: 1 }}>
              <span className="sm:hidden"><AnalogClock tz={c.timezone} active={active} now={now} size={56} /></span>
              <span className="hidden sm:block"><AnalogClock tz={c.timezone} active={active} now={now} size={72} /></span>
              <span className="text-[10px] sm:text-[11px] font-semibold" style={{
                color: active ? "var(--ink-900)" : "var(--ink-300)",
              }}>{c.city}</span>
              <span className="text-[10px] tabular font-medium" style={{
                color: active ? "var(--ink-700)" : "var(--ink-300)",
              }}>{timeStr}</span>
              <span className="text-[9px] font-medium" style={{
                color: active ? "var(--accent)" : "var(--ink-300)",
              }}>{sessionLabel}</span>
            </div>
          );
        })}
      </div>

      {isCrypto && cryptoInfo.overlap && (
        <div className="mt-3 text-center">
          <span className="text-[13px] font-medium tracking-wide text-black">
            Peak Volume — London + US overlap
          </span>
        </div>
      )}
      {!isCrypto && isStale && (
        <div className="mt-3 text-center">
          <span className="text-[13px] font-medium tracking-wide text-black">
            Schedule window may be open, but oracle feed is currently quiet
          </span>
        </div>
      )}
    </div>
  );
}

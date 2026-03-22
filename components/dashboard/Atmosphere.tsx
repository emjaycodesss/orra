"use client";

import type { WeatherSeverity, Regime, MarketSession } from "@/lib/weather";

interface Props {
  weatherSeverity: WeatherSeverity;
  regime: Regime;
  marketSession: MarketSession;
}

const SESSION_BG: Record<MarketSession, string> = {
  preMarket: "from-night-950 via-indigo-950/20 to-night-950",
  regular: "from-night-950 via-night-900 to-night-950",
  postMarket: "from-night-950 via-slate-900/20 to-night-950",
  overNight: "from-night-950 via-blue-950/10 to-night-950",
  closed: "from-night-950 via-night-950 to-night-950",
};

export function Atmosphere({ weatherSeverity, regime, marketSession }: Props) {
  const regimeColor =
    regime === "bull"
      ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(240,180,41,0.04) 0%, transparent 70%)"
      : regime === "bear"
        ? "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(91,141,239,0.04) 0%, transparent 70%)"
        : "none";

  const fogBlur = weatherSeverity === "fog" ? "blur(1px)" : "blur(0px)";
  const stormOpacity =
    weatherSeverity === "stormy" ? 0.06 : weatherSeverity === "fog" ? 0.1 : 0;

  return (
    <>
      <div className="grain-overlay" />
      <div className="fixed inset-0 -z-10">
        <div
          className={`absolute inset-0 bg-gradient-to-b ${SESSION_BG[marketSession]} transition-all duration-[5000ms]`}
        />
        <div
          className="absolute inset-0 transition-all duration-[4000ms]"
          style={{ background: regimeColor }}
        />
        <div
          className="absolute inset-0 transition-all duration-[3000ms]"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, rgba(248,113,113,${stormOpacity}) 0%, transparent 60%)`,
            filter: fogBlur,
          }}
        />
      </div>
    </>
  );
}

"use client";

import type { CSSProperties } from "react";

type SkelShape = "text" | "pill" | "ui" | "circle" | "divider";

function SkelBone({
  className,
  style,
  dark,
  shape = "text",
}: {
  className?: string;
  style?: CSSProperties;
  dark?: boolean;
  shape?: SkelShape;
}) {
  const base = dark ? "dashboard-skel-bone--dark" : "dashboard-skel-bone";
  const shapeCls =
    shape === "text"
      ? "dashboard-skel-bone--text"
      : shape === "ui"
        ? "dashboard-skel-bone--ui"
        : shape === "divider"
          ? "dashboard-skel-bone--divider"
          : "dashboard-skel-bone--pill";
  return <div className={`${base} ${shapeCls} ${className ?? ""}`} style={style} />;
}

/** Static glass tank silhouette matched to `LiquidityTank` (44×72) */
function LiquidityTankSkeleton() {
  return (
    <svg
      width={44}
      height={72}
      viewBox="0 0 44 72"
      className="shrink-0 text-[rgba(167,139,250,0.25)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="dashboard-skel-tank-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.5" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <rect x="2.5" y="2.5" width="39" height="67" rx="8" fill="var(--surface-3)" opacity="0.85" />
      <rect
        x="5"
        y="10"
        width="34"
        height="50"
        rx="6"
        fill="url(#dashboard-skel-tank-g)"
        className="dashboard-skel-tank-fill"
      />
      <path
        d="M 8 26 L 14 24 L 22 27 L 30 23 L 36 26"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        opacity="0.35"
      />
    </svg>
  );
}

function NowCardSkeleton() {
  return (
    <div
      className="relative h-full min-h-[320px] overflow-hidden opacity-0 animate-fade-up sm:min-h-0"
      style={{
        borderRadius: 16,
        background: "radial-gradient(circle 280px at 0% 0%, #3B2D50, #1A1225)",
        boxShadow:
          "3px 3px 6px rgba(26, 18, 37, 0.25), 0 2px 4px rgba(26, 18, 37, 0.15), inset 1px 1px 2px rgba(167, 139, 250, 0.1), inset -1px -1px 2px rgba(26, 18, 37, 0.1)",
      }}
    >
      <div
        className="pointer-events-none absolute h-[35px] w-[160px] opacity-20 sm:h-[45px] sm:w-[220px]"
        style={{
          borderRadius: 100,
          backgroundColor: "#A78BFA",
          filter: "blur(12px)",
          transformOrigin: "10%",
          top: 0,
          left: 0,
          transform: "rotate(40deg)",
        }}
      />

      <div
        className="pointer-events-none absolute left-0 top-3.5 h-px w-full sm:top-[18px]"
        style={{ background: "linear-gradient(90deg, #A78BFA15 30%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-3.5 left-0 h-px w-full sm:bottom-[18px]"
        style={{ background: "linear-gradient(90deg, transparent 30%, #2D264030 70%)" }}
      />
      <div
        className="pointer-events-none absolute left-3.5 top-0 h-full w-px sm:left-[18px]"
        style={{ background: "linear-gradient(180deg, #A78BFA15 30%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute right-3.5 top-0 h-full w-px sm:right-[18px]"
        style={{ background: "linear-gradient(180deg, transparent 30%, #2D264030 70%)" }}
      />

      <div
        className="pointer-events-none absolute inset-[14px] border border-[rgba(167,139,250,0.12)] sm:inset-[18px]"
        style={{ boxShadow: "inset 0 0 24px rgba(167, 139, 250, 0.04)" }}
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-0 flex-col p-4 sm:p-5 md:p-6">
        <div className="mb-3 flex shrink-0 items-center gap-2.5 sm:mb-4 md:mb-5">
          <SkelBone dark shape="circle" className="h-7 w-7 rounded-full" />
          <SkelBone dark className="h-4 w-24 sm:w-32" shape="text" />
        </div>

        <SkelBone dark className="mb-2.5 h-10 w-[70%] max-w-[220px] sm:h-11" />
        <div className="mb-4 flex items-center gap-2 sm:mb-5">
          <SkelBone dark className="h-4 w-20" />
          <SkelBone dark className="h-3 w-14 opacity-80" />
        </div>

        <div className="min-h-2 flex-1" aria-hidden />

        <div className="shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <SkelBone dark className="h-2.5 w-10" />
            <SkelBone dark className="h-2.5 w-16" />
          </div>
          <div className="flex items-center justify-between">
            <SkelBone dark className="h-2.5 w-24" />
            <SkelBone dark className="h-2.5 w-20" />
          </div>
          <div className="flex items-center justify-between">
            <SkelBone dark className="h-2.5 w-28" />
            <SkelBone dark className="h-2.5 w-[4.5rem]" />
          </div>
        </div>

        <div className="min-h-2 flex-1" aria-hidden />

        <div className="shrink-0 pt-3 sm:pt-4">
          <div className="mb-2.5 flex items-center justify-between">
            <SkelBone dark className="h-2.5 w-20" />
            <SkelBone dark className="h-2.5 w-14" />
          </div>
          <div className="flex flex-wrap gap-[5px]">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className="h-[7px] w-[7px] rounded-full"
                style={{
                  backgroundColor: "rgba(167,139,250,0.14)",
                  opacity: 0.45 + (i % 5) * 0.06,
                }}
              />
            ))}
          </div>
          <SkelBone dark className="mt-2 h-2 w-28 opacity-70" />
        </div>
      </div>
    </div>
  );
}

function TrendSkeleton() {
  return (
    <div className="card-surface card-surface-static flex animate-fade-up-1 flex-col opacity-0 p-4 sm:p-5">
      <SkelBone className="mb-3 h-3 w-14" />
      <SkelBone className="mb-1.5 h-8 w-28 sm:h-9 sm:w-32" />
      <SkelBone className="mb-3 mt-1 h-3.5 w-36" />
      <div className="mt-auto">
        <div className="mb-2 flex items-center justify-between">
          <SkelBone className="h-3 w-[4.5rem]" />
          <SkelBone className="h-3 w-[4.5rem]" />
        </div>
        <div className="relative flex items-center" style={{ height: 12 }}>
          <div
            className="h-1.5 w-full rounded-full"
            style={{
              background:
                "linear-gradient(180deg, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0.16) 100%)",
              boxShadow: "inset 0 1px 2px rgba(26,18,37,0.12)",
            }}
          />
          <SkelBone shape="ui" className="absolute top-1/2 h-[18px] w-1.5 -translate-x-1/2 -translate-y-1/2" style={{ left: "52%" }} />
        </div>
      </div>
    </div>
  );
}

function OrderBookSkeleton() {
  return (
    <div className="card-surface card-surface-static flex animate-fade-up-1 flex-col opacity-0 p-4 sm:p-5">
      <SkelBone className="mb-3 h-3 w-24" />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SkelBone className="h-3 w-8" />
          <SkelBone className="h-4 w-28" />
        </div>
        <div className="flex items-center justify-between">
          <SkelBone className="h-3 w-8" />
          <SkelBone className="h-4 w-28" />
        </div>
      </div>
      <div className="mt-3 space-y-3 pt-1">
        <SkelBone shape="divider" className="h-[2px] w-full" />
        <div className="flex items-center justify-between">
          <SkelBone className="h-3 w-14" />
          <SkelBone className="h-3 w-[7.5rem]" />
        </div>
      </div>
    </div>
  );
}

function LiquiditySkeleton() {
  return (
    <div className="card-surface card-surface-static flex animate-fade-up-1 flex-col opacity-0 p-4 sm:p-5">
      <SkelBone className="mb-3 h-3 w-20" />
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col gap-2">
          <SkelBone className="h-7 w-20 sm:h-8 sm:w-24" />
          <SkelBone className="h-3 w-[85%] max-w-[10rem]" />
          <SkelBone className="h-3 w-[75%] max-w-[9rem]" />
        </div>
        <LiquidityTankSkeleton />
      </div>
    </div>
  );
}

function SignalSkeleton() {
  return (
    <div
      className="card-surface card-surface-static relative flex animate-fade-up-2 flex-col overflow-hidden p-4 opacity-0 sm:p-5 md:p-6"
      style={{
        background: "linear-gradient(160deg, #F5F2FB 0%, #EDE5F9 42%, #E2D6F4 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, rgba(167,139,250,0.35) 0%, transparent 70%)" }}
        aria-hidden
      />
      <SkelBone className="relative z-[1] mb-3 h-3 w-28" />
      <SkelBone className="relative z-[1] h-8 w-40 sm:h-9" />
      <div className="relative z-[1] mt-2.5 flex flex-col gap-2">
        <SkelBone className="h-3.5 w-full max-w-md" />
        <SkelBone className="h-3.5 w-[92%] max-w-md" />
        <SkelBone className="h-3 w-[55%] max-w-sm" />
      </div>
      <div className="relative z-[1] mt-auto pt-4">
        <SkelBone className="h-3.5 w-52 max-w-[85%]" />
      </div>
    </div>
  );
}

function SessionsSkeleton() {
  return (
    <div className="card-surface card-surface-static flex animate-fade-up-2 flex-col opacity-0 p-4 sm:p-5">
      <SkelBone className="mb-4 h-3 w-36" />
      <div className="flex items-start justify-between gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <SkelBone shape="circle" className="rounded-full" style={{ width: 56, height: 56 }} />
            <SkelBone className="h-3 w-12" />
            <SkelBone className="h-2.5 w-10" />
            <SkelBone className="h-2 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SparklineSkeleton() {
  return (
    <div className="opacity-0 animate-fade-up-3">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <SkelBone className="h-3 w-14" />
        <div className="flex items-center gap-3">
          <SkelBone className="h-3 w-28" />
          <SkelBone className="h-3 w-16" />
        </div>
      </div>
      <div className="card-surface card-surface-static h-[180px] w-full overflow-hidden rounded-2xl sm:h-[240px] md:h-[300px]">
        <div className="flex h-full w-full items-end gap-[3px] px-6 pb-8">
          {Array.from({ length: 60 }, (_, i) => {
            const h = 20 + Math.sin(i * 0.3) * 30 + ((i * 17 + 7) % 40);
            return (
              <div
                key={i}
                className="skeleton flex-1 rounded-t"
                style={{ height: `${h}%`, animationDelay: `${i * 30}ms` }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-skel-root">
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]">
        <NowCardSkeleton />
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <TrendSkeleton />
            <OrderBookSkeleton />
            <LiquiditySkeleton />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SessionsSkeleton />
            <SignalSkeleton />
          </div>
        </div>
      </div>
      <SparklineSkeleton />
    </div>
  );
}

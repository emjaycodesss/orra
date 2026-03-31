"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type { TimeRange, SparklineStatus } from "@/hooks/useSparkline";
import { formatAxisPriceAdaptive, formatPriceAdaptive, inferAxisDecimals } from "@/lib/format-price";

interface Props {
  data: { time: number; close: number }[];
  status: SparklineStatus;
  regime: "bull" | "bear" | "neutral";
  timeRange: TimeRange;
}

const RANGE_LABELS: Record<TimeRange, string> = {
  daily: "today",
  weekly: "this week",
  monthly: "this month",
};

function formatTime(ts: number, range: TimeRange): string {
  const d = new Date(ts * 1000);
  if (range === "daily") return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (range === "weekly") return d.toLocaleDateString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatAxisTime(ts: number, range: TimeRange): string {
  const d = new Date(ts * 1000);
  if (range === "daily") return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (range === "weekly") return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CHART_HEIGHT = 300;
const PAD_Y = 24;
const PAD_BOTTOM = 28;
const PAD_RIGHT = 72;
const DRAG_THRESHOLD = 4;
const MIN_PX_FLOOR = 1;
const MAX_PX = 24;
const DEFAULT_PX = 8;
const ZOOM_FACTOR = 1.06;

function clampScroll(el: HTMLDivElement) {
  const maxX = Math.max(0, el.scrollWidth - el.clientWidth);
  const maxY = Math.max(0, el.scrollHeight - el.clientHeight);
  el.scrollLeft = Math.min(Math.max(0, el.scrollLeft), maxX);
  el.scrollTop = Math.min(Math.max(0, el.scrollTop), maxY);
}

export function Sparkline({ data, status, regime, timeRange }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pxPerPoint, setPxPerPoint] = useState(DEFAULT_PX);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const scrollStartX = useRef(0);
  const scrollStartY = useRef(0);
  const prevKey = useRef("");
  const containerWidthRef = useRef(800);
  const pendingScrollToEndRef = useRef(false);

  const clampRafScheduledRef = useRef(false);
  const scheduleClamp = useCallback(() => {
    if (clampRafScheduledRef.current) return;
    clampRafScheduledRef.current = true;
    requestAnimationFrame(() => {
      clampRafScheduledRef.current = false;
      const el = scrollRef.current;
      if (!el || data.length < 2) return;
      if (pendingScrollToEndRef.current) {
        pendingScrollToEndRef.current = false;
        el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
      }
      clampScroll(el);
    });
  }, [data.length]);

  const getMinPx = useCallback(() => {
    if (data.length < 2) return MIN_PX_FLOOR;
    const cw = containerWidthRef.current;
    const plotBudget = cw - PAD_RIGHT;
    if (plotBudget <= 0) return MIN_PX_FLOOR;
    return Math.max(MIN_PX_FLOOR, plotBudget / data.length);
  }, [data.length]);

  const dataKey = `${data.length}-${timeRange}`;
  const scheduledResetRef = useRef<string | null>(null);
  if (scrollRef.current && data.length > 0 && prevKey.current !== dataKey && scheduledResetRef.current !== dataKey) {
    prevKey.current = dataKey;
    scheduledResetRef.current = dataKey;
    queueMicrotask(() => {
      pendingScrollToEndRef.current = true;
      const el = scrollRef.current;
      if (el) containerWidthRef.current = el.clientWidth;
      const minP = getMinPx();
      minPxRef.current = minP;
      setPxPerPoint(Math.max(minP, DEFAULT_PX));
      scheduleClamp();
      if (scheduledResetRef.current === dataKey) {
        scheduledResetRef.current = null;
      }
    });
  }

  const pxRef = useRef(pxPerPoint);
  pxRef.current = pxPerPoint;
  const dataLenRef = useRef(data.length);
  dataLenRef.current = data.length;
  const minPxRef = useRef(getMinPx());
  minPxRef.current = getMinPx();

  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const wheelNodeRef = useRef<HTMLDivElement | null>(null);
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>((e: WheelEvent) => {
    if (dataLenRef.current < 2) return;
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const posInChart = el.scrollLeft + cursorX;
    const oldPx = pxRef.current;
    const dataIndex = posInChart / oldPx;
    const dir = e.deltaY < 0 ? 1 : -1;
    const newPx = Math.min(MAX_PX, Math.max(minPxRef.current, oldPx * (dir > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR)));
    if (newPx === oldPx) return;
    setPxPerPoint(newPx);
    requestAnimationFrame(() => {
      const sc = scrollRef.current;
      if (!sc) return;
      sc.scrollLeft = dataIndex * newPx - cursorX;
      clampScroll(sc);
    });
  });

  const scrollCallbackRef = useCallback((el: HTMLDivElement | null) => {
    if (wheelNodeRef.current) {
      wheelNodeRef.current.removeEventListener("wheel", wheelHandlerRef.current);
      wheelNodeRef.current = null;
    }

    if (resizeObserverRef.current && scrollRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    scrollRef.current = el;
    if (el) {
      containerWidthRef.current = el.clientWidth;
      el.addEventListener("wheel", wheelHandlerRef.current, { passive: false });
      wheelNodeRef.current = el;

      const ro = new ResizeObserver(() => {
        const sc = scrollRef.current;
        if (!sc) return;
        const len = dataLenRef.current;
        if (len < 2) return;
        containerWidthRef.current = sc.clientWidth;
        const inner = sc.clientWidth - PAD_RIGHT;
        const minP = inner > 0 ? Math.max(MIN_PX_FLOOR, inner / len) : MIN_PX_FLOOR;
        minPxRef.current = minP;
        setPxPerPoint((p) => Math.max(minP, p));
        scheduleClamp();
      });
      ro.observe(el);
      resizeObserverRef.current = ro;
    }
  }, [scheduleClamp]);

  const zoomIn = useCallback(() => {
    setPxPerPoint((p) => Math.min(MAX_PX, p * ZOOM_FACTOR));
    scheduleClamp();
  }, [scheduleClamp]);

  const zoomOut = useCallback(() => {
    setPxPerPoint((p) => Math.max(minPxRef.current, p / ZOOM_FACTOR));
    scheduleClamp();
  }, [scheduleClamp]);

  const zoomReset = useCallback(() => {
    pendingScrollToEndRef.current = true;
    setPxPerPoint(DEFAULT_PX);
    scheduleClamp();
  }, [scheduleClamp]);

  const handlePointerDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    dragStartY.current = e.clientY;
    scrollStartX.current = scrollRef.current?.scrollLeft ?? 0;
    scrollStartY.current = scrollRef.current?.scrollTop ?? 0;
  }, []);

  const handlePointerMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current && scrollRef.current) {
      const dx = dragStartX.current - e.clientX;
      const dy = dragStartY.current - e.clientY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        hasDragged.current = true;
        setHoverIndex(null);
      }
      if (hasDragged.current) {
        const sc = scrollRef.current;
        const maxScrollX = Math.max(0, sc.scrollWidth - sc.clientWidth);
        const maxScrollY = Math.max(0, sc.scrollHeight - sc.clientHeight);
        sc.scrollLeft = Math.min(Math.max(0, scrollStartX.current + dx), maxScrollX);
        sc.scrollTop = Math.min(Math.max(0, scrollStartY.current + dy), maxScrollY);
        return;
      }
    }
    if (!hasDragged.current && scrollRef.current && data.length > 1) {
      const svgEl = svgRef.current;
      if (!svgEl) return;
      const rect = svgEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const chartW = data.length * pxPerPoint;
      const idx = Math.round((x / chartW) * (data.length - 1));
      setHoverIndex(Math.max(0, Math.min(data.length - 1, idx)));
    }
  }, [data.length, pxPerPoint]);

  const handlePointerUp = useCallback(() => { isDragging.current = false; hasDragged.current = false; }, []);
  const handlePointerLeave = useCallback(() => { isDragging.current = false; hasDragged.current = false; setHoverIndex(null); }, []);

  const { min, max, openPrice, currentPrice } = useMemo(() => {
    if (data.length < 2) {
      return { min: 0, max: 1, openPrice: 0, currentPrice: 0 };
    }
    let lo = Infinity, hi = -Infinity;
    for (const d of data) {
      if (d.close < lo) lo = d.close;
      if (d.close > hi) hi = d.close;
    }
    return { min: lo, max: hi, openPrice: data[0].close, currentPrice: data[data.length - 1].close };
  }, [data]);

  const range = max - min || 1;
  const chartW = data.length * pxPerPoint;
  const totalW = chartW + PAD_RIGHT;
  const drawH = CHART_HEIGHT - PAD_Y - PAD_BOTTOM;

  const { points, lineD, areaD, shadowLineD } = useMemo(() => {
    if (data.length < 2) {
      return { points: [] as { x: number; y: number }[], lineD: "", areaD: "", shadowLineD: "" };
    }
    const pts = data.map((d, i) => ({
      x: i * pxPerPoint,
      y: PAD_Y + drawH - ((d.close - min) / range) * drawH,
    }));
    const coordStr = pts.map((p) => `${p.x},${p.y}`).join(" L ");
    const lD = `M ${coordStr}`;
    const aD = `${lD} L ${chartW},${CHART_HEIGHT - PAD_BOTTOM} L 0,${CHART_HEIGHT - PAD_BOTTOM} Z`;
    const sD = `M ${pts.map((p) => `${p.x},${p.y + 3}`).join(" L ")}`;
    return { points: pts, lineD: lD, areaD: aD, shadowLineD: sD };
  }, [data, pxPerPoint, min, range, drawH, chartW]);

  if (data.length < 2) {
    if (status === "loading") {
      return (
        <div className="w-full h-[180px] sm:h-[240px] md:h-[300px] flex items-center justify-center card-surface card-surface-static">
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 rounded-full bg-surface-4 animate-pulse" />
            <div className="w-24 h-1.5 rounded-full bg-surface-4 animate-pulse" />
            <div className="w-8 h-1.5 rounded-full bg-surface-4 animate-pulse" />
          </div>
        </div>
      );
    }
    return (
      <div className="w-full h-[180px] sm:h-[240px] md:h-[300px] flex items-center justify-center card-surface card-surface-static">
        <div className="flex items-center gap-2">
          <div className="w-4 h-px bg-surface-4" />
          <span className="text-xs font-medium text-ink-400 tracking-wider uppercase">No chart data available for this period</span>
          <div className="w-4 h-px bg-surface-4" />
        </div>
      </div>
    );
  }

  const changePct = ((currentPrice - openPrice) / openPrice) * 100;
  const displayPrice = hoverIndex !== null ? data[hoverIndex].close : currentPrice;
  const displayChange = hoverIndex !== null
    ? ((data[hoverIndex].close - openPrice) / openPrice) * 100
    : changePct;

  const targetLabels = Math.max(6, Math.min(15, Math.floor(data.length / 20)));
  const labelInterval = Math.max(1, Math.floor(data.length / targetLabels));
  const timeLabels: { x: number; label: string }[] = [];
  for (let i = 0; i < data.length; i += labelInterval) {
    timeLabels.push({ x: i * pxPerPoint, label: formatAxisTime(data[i].time, timeRange) });
  }

  const priceSteps = 5;
  const axisDecimals = inferAxisDecimals(min, max, priceSteps);
  const priceLabels: { y: number; label: string }[] = [];
  for (let i = 0; i <= priceSteps; i++) {
    const val = min + (range * i) / priceSteps;
    const y = PAD_Y + drawH - (i / priceSteps) * drawH;
    priceLabels.push({ y, label: formatAxisPriceAdaptive(val, axisDecimals) });
  }

  const lastPt = points[points.length - 1];
  const zoomPct = Math.round((pxPerPoint / DEFAULT_PX) * 100);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-baseline justify-between gap-1 mb-3 px-1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-ink-900">
            {RANGE_LABELS[timeRange]}
          </span>
          {hoverIndex !== null && (
            <span className="text-xs font-medium text-ink-500 tabular">
              {formatTime(data[hoverIndex].time, timeRange)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm tabular">
          <span className="text-ink-700 font-medium">{formatPriceAdaptive(displayPrice)}</span>
          <span className="font-semibold" style={{ color: displayChange >= 0 ? "var(--positive)" : "var(--danger)" }}>
            {displayChange > 0 ? "+" : ""}{displayChange.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="relative card-surface card-surface-static overflow-hidden !rounded-2xl h-[180px] sm:h-[240px] md:h-[300px]">

        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
          <button onClick={zoomOut}
            className="zoom-btn group" aria-label="Zoom out">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-ink-500 group-hover:text-accent transition-colors">
              <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button onClick={zoomReset}
            className="zoom-btn-pct">
            {zoomPct}%
          </button>
          <button onClick={zoomIn}
            className="zoom-btn group" aria-label="Zoom in">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-ink-500 group-hover:text-accent transition-colors">
              <line x1="7" y1="3" x2="7" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div
          ref={scrollCallbackRef}
          className="overflow-x-auto overflow-y-auto h-full cursor-grab active:cursor-grabbing overscroll-contain"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerLeave}
        >
          <svg ref={svgRef} width={totalW} height={CHART_HEIGHT} className="block select-none" style={{ minWidth: totalW }}>
            <defs>
              <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.14" />
                <stop offset="60%" stopColor="#A78BFA" stopOpacity="0.04" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
              </linearGradient>
              <filter id="lineShadow">
                <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#7C3AED" floodOpacity="0.15" />
              </filter>
              <radialGradient id="dotGlow">
                <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#7C3AED" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
              </radialGradient>
            </defs>

            {priceLabels.map((p, i) => (
              <line key={i} x1={0} y1={p.y} x2={chartW} y2={p.y}
                stroke="rgba(26,18,37,0.04)" strokeWidth="1" />
            ))}

            {timeLabels.map((t, i) => (
              <g key={i}>
                <line x1={t.x} y1={PAD_Y} x2={t.x} y2={CHART_HEIGHT - PAD_BOTTOM}
                  stroke="rgba(26,18,37,0.04)" strokeWidth="1" />
                <text x={t.x} y={CHART_HEIGHT - 8}
                  fill="var(--ink-400)" fontSize="9" fontFamily="Manrope" fontWeight="500"
                  textAnchor="middle">
                  {t.label}
                </text>
              </g>
            ))}

            <path d={shadowLineD} fill="none" stroke="rgba(124,58,237,0.08)" strokeWidth="4"
              strokeLinejoin="round" strokeLinecap="round" />
            <path d={areaD} fill="url(#gradPurple)" />
            <path d={lineD} fill="none" stroke="#7C3AED" strokeWidth="2.5"
              strokeLinejoin="round" strokeLinecap="round" filter="url(#lineShadow)" />
            <path d={lineD} fill="none" stroke="#A78BFA" strokeWidth="1"
              strokeLinejoin="round" strokeLinecap="round" opacity="0.4" />

            {hoverIndex !== null && !hasDragged.current && (
              <>
                <line x1={points[hoverIndex].x} y1={PAD_Y} x2={points[hoverIndex].x}
                  y2={CHART_HEIGHT - PAD_BOTTOM}
                  stroke="rgba(124,58,237,0.2)" strokeWidth="1" strokeDasharray="3 3" />
                <line x1={0} y1={points[hoverIndex].y} x2={chartW} y2={points[hoverIndex].y}
                  stroke="rgba(124,58,237,0.1)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={points[hoverIndex].x} cy={points[hoverIndex].y} r="16" fill="url(#dotGlow)" />
                <circle cx={points[hoverIndex].x} cy={points[hoverIndex].y} r="5" fill="#A78BFA" />
                <circle cx={points[hoverIndex].x} cy={points[hoverIndex].y} r="3" fill="#DDD6FE" />
              </>
            )}

            {hoverIndex === null && (
              <>
                <circle cx={lastPt.x} cy={lastPt.y} r="16" fill="url(#dotGlow)" />
                <circle cx={lastPt.x} cy={lastPt.y} r="5" fill="#A78BFA" className="animate-pulse-dot" />
                <circle cx={lastPt.x} cy={lastPt.y} r="3" fill="#DDD6FE" />
              </>
            )}

            {priceLabels.map((p, i) => (
              <text key={`price-${i}`} x={chartW + 8} y={p.y + 3}
                fill="var(--ink-400)" fontSize="9" fontFamily="Manrope" fontWeight="600">
                {p.label}
              </text>
            ))}
          </svg>
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none max-w-[95%] text-center">
          <span className="text-[10px] font-medium text-ink-300 tracking-wider uppercase opacity-60 sm:text-[11px]">
            <span className="sm:hidden">Drag chart to pan · +/- to zoom</span>
            <span className="hidden sm:inline">Scroll to zoom / drag to pan</span>
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef, useLayoutEffect } from "react";
import type { TimeRange } from "@/hooks/useSparkline";

interface Props {
  data: { time: number; close: number }[];
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

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
}

function formatAxisPrice(price: number): string {
  if (price >= 100000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (price >= 100) return price.toFixed(1);
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
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

export function Sparkline({ data, regime, timeRange }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [pxPerPoint, setPxPerPoint] = useState(DEFAULT_PX);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const prevKey = useRef("");
  const containerWidthRef = useRef(800);

  const getMinPx = useCallback(() => {
    if (data.length < 2) return MIN_PX_FLOOR;
    const priceAxisWidth = 60;
    return Math.max(MIN_PX_FLOOR, (containerWidthRef.current - priceAxisWidth) / data.length);
  }, [data.length]);

  // Reset zoom + auto-scroll on new data
  const dataKey = `${data.length}-${timeRange}`;
  useLayoutEffect(() => {
    if (scrollRef.current && data.length > 0 && prevKey.current !== dataKey) {
      prevKey.current = dataKey;
      setPxPerPoint(DEFAULT_PX);
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      });
    }
  }, [data.length, dataKey]);

  // Native wheel listener with { passive: false } to allow preventDefault
  const pxRef = useRef(pxPerPoint);
  pxRef.current = pxPerPoint;
  const dataLenRef = useRef(data.length);
  dataLenRef.current = data.length;
  const minPxRef = useRef(getMinPx());
  minPxRef.current = getMinPx();

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
      if (scrollRef.current) scrollRef.current.scrollLeft = dataIndex * newPx - cursorX;
    });
  });

  const scrollCallbackRef = useCallback((el: HTMLDivElement | null) => {
    if (wheelNodeRef.current) {
      wheelNodeRef.current.removeEventListener("wheel", wheelHandlerRef.current);
      wheelNodeRef.current = null;
    }
    scrollRef.current = el;
    if (el) {
      containerWidthRef.current = el.clientWidth;
      el.addEventListener("wheel", wheelHandlerRef.current, { passive: false });
      wheelNodeRef.current = el;
    }
  }, []);

  const zoomIn = useCallback(() => {
    setPxPerPoint((p) => Math.min(MAX_PX, p * ZOOM_FACTOR));
  }, []);

  const zoomOut = useCallback(() => {
    setPxPerPoint((p) => Math.max(minPxRef.current, p / ZOOM_FACTOR));
  }, []);

  const zoomReset = useCallback(() => {
    setPxPerPoint(DEFAULT_PX);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    });
  }, []);

  const handlePointerDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    hasDragged.current = false;
    dragStartX.current = e.clientX;
    scrollStartX.current = scrollRef.current?.scrollLeft ?? 0;
  }, []);

  const handlePointerMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current && scrollRef.current) {
      const dx = dragStartX.current - e.clientX;
      if (Math.abs(dx) > DRAG_THRESHOLD) {
        hasDragged.current = true;
        setHoverIndex(null);
      }
      if (hasDragged.current) {
        scrollRef.current.scrollLeft = scrollStartX.current + dx;
        return;
      }
    }
    if (!hasDragged.current && scrollRef.current && data.length > 1) {
      const svgEl = scrollRef.current.querySelector("svg");
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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true; hasDragged.current = false;
    dragStartX.current = e.touches[0].clientX;
    scrollStartX.current = scrollRef.current?.scrollLeft ?? 0;
  }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = dragStartX.current - e.touches[0].clientX;
    if (Math.abs(dx) > DRAG_THRESHOLD) hasDragged.current = true;
    if (hasDragged.current) scrollRef.current.scrollLeft = scrollStartX.current + dx;
  }, []);
  const handleTouchEnd = useCallback(() => { isDragging.current = false; hasDragged.current = false; }, []);

  if (data.length < 2) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center rounded-2xl bg-surface-1 border border-surface-3"
        style={{ boxShadow: "0 6px 0 var(--surface-4), 0 8px 20px rgba(26,18,37,0.1)" }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-px bg-surface-4 animate-pulse" />
          <span className="text-[10px] font-medium text-ink-400 tracking-wider uppercase">awaiting data</span>
          <div className="w-4 h-px bg-surface-4 animate-pulse" />
        </div>
      </div>
    );
  }

  const closes = data.map((d) => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const chartW = data.length * pxPerPoint;
  const totalW = chartW + PAD_RIGHT;
  const drawH = CHART_HEIGHT - PAD_Y - PAD_BOTTOM;

  const points = data.map((d, i) => {
    const x = i * pxPerPoint;
    const y = PAD_Y + drawH - ((d.close - min) / range) * drawH;
    return { x, y };
  });

  const lineD = `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}`;
  const areaD = `${lineD} L ${chartW},${CHART_HEIGHT - PAD_BOTTOM} L 0,${CHART_HEIGHT - PAD_BOTTOM} Z`;
  const shadowLineD = `M ${points.map((p) => `${p.x},${p.y + 3}`).join(" L ")}`;

  const openPrice = closes[0];
  const currentPrice = closes[closes.length - 1];
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
  const priceLabels: { y: number; label: string }[] = [];
  for (let i = 0; i <= priceSteps; i++) {
    const val = min + (range * i) / priceSteps;
    const y = PAD_Y + drawH - (i / priceSteps) * drawH;
    priceLabels.push({ y, label: formatAxisPrice(val) });
  }

  const lastPt = points[points.length - 1];
  const zoomPct = Math.round((pxPerPoint / DEFAULT_PX) * 100);

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-normal uppercase text-ink-900">
            {RANGE_LABELS[timeRange]}
          </span>
          {hoverIndex !== null && (
            <span className="text-[10px] font-medium text-ink-500 tabular">
              {formatTime(data[hoverIndex].time, timeRange)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] tabular">
          <span className="text-ink-700 font-medium">{formatPrice(displayPrice)}</span>
          <span className="font-semibold" style={{ color: displayChange >= 0 ? "var(--clear)" : "var(--storm)" }}>
            {displayChange > 0 ? "+" : ""}{displayChange.toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="relative rounded-2xl bg-surface-1 border border-surface-3 overflow-hidden"
        style={{ height: CHART_HEIGHT, boxShadow: "0 6px 0 var(--surface-4), 0 8px 20px rgba(26,18,37,0.1)" }}>

        {/* Zoom controls */}
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

        {/* Scrollable chart */}
        <div
          ref={scrollCallbackRef}
          className="overflow-x-auto overflow-y-hidden h-full cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <svg width={totalW} height={CHART_HEIGHT} className="block select-none" style={{ minWidth: totalW }}>
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

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="text-[9px] font-medium text-ink-300 tracking-wider uppercase opacity-60">
            scroll to zoom / drag to pan
          </span>
        </div>
      </div>
    </div>
  );
}

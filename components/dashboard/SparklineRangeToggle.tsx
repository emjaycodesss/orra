"use client";

import { useMemo } from "react";
import type { TimeRange } from "@/hooks/useSparkline";

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "daily", label: "1D" },
  { value: "weekly", label: "7D" },
  { value: "monthly", label: "30D" },
];

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function SparklineRangeToggle({ value, onChange }: Props) {
  const activeIndex = useMemo(
    () => RANGES.findIndex((r) => r.value === value),
    [value]
  );

  return (
    <div
      className="relative inline-grid grid-flow-col overflow-hidden"
      role="group"
      aria-label="Chart time range"
      style={{
        padding: 3,
        borderRadius: 12,
        background: "var(--surface-2)",
        border: "1px solid var(--surface-3)",
      }}
    >
      <div
        className="absolute z-[1]"
        style={{
          inset: 3,
          width: `calc(100% / ${RANGES.length} - 3px)`,
          borderRadius: 9,
          background: "var(--surface-0)",
          boxShadow:
            "3px 3px 6px rgba(26, 18, 37, 0.1), 0 2px 4px rgba(26, 18, 37, 0.06), inset 1px 1px 2px rgba(255, 255, 255, 0.7), inset -1px -1px 2px rgba(26, 18, 37, 0.04)",
          transform: `translateX(${activeIndex * 100}%)`,
          transition: "transform 0.55s cubic-bezier(0.22, 0.9, 0.25, 1)",
        }}
      />

      {RANGES.map(({ value: v, label }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="relative z-[2] whitespace-nowrap cursor-pointer"
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.5px",
              color: active ? "var(--ink-700)" : "var(--ink-400)",
              textShadow: active ? "0 1px 0 rgba(255,255,255,0.6)" : "none",
              transition: "color 0.35s ease, transform 0.2s ease",
              background: "none",
              border: "none",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

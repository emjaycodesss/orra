"use client";

import { useState } from "react";

interface Props {
  warnings: string[];
}

export function WarningBanner({ warnings }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || warnings.length === 0) return null;

  return (
    <div className="fixed top-20 left-0 right-0 z-40 px-4 pt-2 animate-slide-down">
      <div className="max-w-5xl mx-auto px-4 py-2.5 rounded-xl bg-surface-1/90 backdrop-blur-md border border-storm/20 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-storm animate-pulse-dot" />
          <div className="flex flex-col gap-0.5">
            {warnings.map((w, i) => (
              <p key={i} className="text-[11px] font-medium text-ink-500">
                {w}
              </p>
            ))}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="ml-4 text-ink-400 hover:text-ink-700 text-xs font-medium transition-colors"
          aria-label="dismiss"
        >
          dismiss
        </button>
      </div>
    </div>
  );
}

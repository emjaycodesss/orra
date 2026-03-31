"use client";

import { useState } from "react";

interface Props {
  warnings: string[];
}

export function WarningBanner({ warnings }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || warnings.length === 0) return null;

  return (
    <div className="fixed top-[84px] sm:top-20 left-0 right-0 z-40 px-3 sm:px-4 pt-2 animate-slide-down">
      <div className="max-w-5xl mx-auto warning-banner-shell rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="warning-banner-badge mt-0.5 shrink-0">
            !
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-accent mb-1">
              Oracle Context
            </p>
            <div className="flex flex-col gap-1">
              {warnings.map((w, i) => (
                <p key={i} className="text-[11px] sm:text-xs font-medium text-ink-600 leading-relaxed">
                  {w}
                </p>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="warning-banner-dismiss ml-1 shrink-0 text-[11px] font-semibold uppercase tracking-wide"
          aria-label="dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

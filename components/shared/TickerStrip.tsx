"use client";

import { useTickerStrip, type TickerFeed } from "@/hooks/useTickerStrip";
import { formatUsdAdaptive } from "@/lib/format-price";

function formatTickerPrice(price: number, label: string): string {
  if (price === 0) return "---";
  if (label === "EUR/USD") return price.toFixed(4);
  if (label === "GOLD" || label === "SILVER")
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return formatUsdAdaptive(price);
}

function TickerPill({ feed, onClick }: { feed: TickerFeed; onClick: () => void }) {
  const changeColor = feed.change24h !== null
    ? feed.change24h > 0.01 ? "var(--positive)" : feed.change24h < -0.01 ? "var(--danger)" : "var(--ink-400)"
    : "var(--ink-300)";

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl shrink-0 transition-all duration-200"
      style={{
        backgroundColor: "var(--surface-2)",
        boxShadow: "2px 2px 4px rgba(26,18,37,0.08), -1px -1px 3px rgba(255,255,255,0.7), inset 0 0.5px 0 rgba(255,255,255,0.5)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "1px 1px 2px rgba(26,18,37,0.06), -0.5px -0.5px 2px rgba(255,255,255,0.5), inset 0 0.5px 0 rgba(255,255,255,0.5)";
        e.currentTarget.style.transform = "translateY(0.5px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "2px 2px 4px rgba(26,18,37,0.08), -1px -1px 3px rgba(255,255,255,0.7), inset 0 0.5px 0 rgba(255,255,255,0.5)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <span className="text-[10px] font-bold tracking-wide text-ink-700">{feed.label}</span>
      <span className="text-[11px] font-semibold tabular-nums text-ink-900">
        {formatTickerPrice(feed.price, feed.label)}
      </span>
      {feed.change24h !== null && (
        <span className="text-[10px] font-bold tabular-nums" style={{ color: changeColor }}>
          {feed.change24h > 0 ? "+" : ""}{feed.change24h.toFixed(2)}%
        </span>
      )}
    </button>
  );
}

function TickerRow({ feeds, onAssetSelect }: { feeds: TickerFeed[]; onAssetSelect?: (id: number, symbol: string, label: string) => void }) {
  return (
    <div className="flex items-center gap-2.5 shrink-0 px-1">
      {feeds.map((feed, i) => (
        <TickerPill
          key={`${feed.id}-${i}`}
          feed={feed}
          onClick={() => onAssetSelect?.(feed.id, feed.symbol, feed.label)}
        />
      ))}
    </div>
  );
}

interface Props {
  onAssetSelect?: (feedId: number, symbol: string, label: string) => void;
}

export function TickerStrip({ onAssetSelect }: Props) {
  const feeds = useTickerStrip();
  const hasData = feeds.some((f) => f.price > 0);

  if (!hasData) {
    return (
      <div className="sticky top-24 sm:top-14 z-20 w-full overflow-hidden"
        style={{
          backgroundColor: "var(--surface-3)",
          boxShadow: "inset 0 2px 6px rgba(26,18,37,0.08), inset 0 1px 2px rgba(26,18,37,0.04), 0 1px 0 rgba(255,255,255,0.5)",
          padding: "8px 0",
        }}
      >
        <div className="flex items-center gap-2.5 px-4">
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl shrink-0"
              style={{ backgroundColor: "var(--surface-2)" }}
            >
              <div className="skeleton h-3 w-8 rounded" />
              <div className="skeleton h-3 w-16 rounded" />
              <div className="skeleton h-3 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-24 sm:top-14 z-20 w-full overflow-hidden"
      style={{
        backgroundColor: "var(--surface-3)",
        boxShadow: "inset 0 2px 6px rgba(26,18,37,0.08), inset 0 1px 2px rgba(26,18,37,0.04), 0 1px 0 rgba(255,255,255,0.5)",
        padding: "8px 0",
      }}
    >
      <div className="flex items-center ticker-marquee">
        <TickerRow feeds={feeds} onAssetSelect={onAssetSelect} />
        <TickerRow feeds={feeds} onAssetSelect={onAssetSelect} />
      </div>
    </div>
  );
}

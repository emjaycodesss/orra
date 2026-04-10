"use client";

import { useState, useRef, useCallback, type ChangeEvent } from "react";
import { Sparkles } from "lucide-react";
import { useWallClockMs } from "@/hooks/useWallClock";
import { devWarn } from "@/lib/dev-warn";

interface SymbolResult {
  id: number;
  symbol: string;
  name: string;
  description: string;
}

export interface AssetWhisperEntry {
  whisper: string;
  clarityClass: string;
  publisherCount: number;
}

interface Props {
  onSelect: (feedId: number, symbol: string, name: string) => void;
  whisperMap?: Map<number, AssetWhisperEntry>;
  onResultsVisible?: (feedIds: number[]) => void;
  variant?: "default" | "cosmic";
}

let cachedSymbols: SymbolResult[] | null = null;
let fetchPromise: Promise<void> | null = null;
const MAX_SEARCH_RESULTS = 5;

function normalizeItems(data: unknown): SymbolResult[] {
  const items = Array.isArray(data)
    ? data
    : (data as { results?: unknown[] } | null)?.results ?? [];
  return items
    .map(
      (item: {
        pyth_lazer_id?: number;
        id?: number;
        price_feed_id?: number;
        symbol?: string;
        name?: string;
        description?: string;
      }) => ({
        id: item.pyth_lazer_id ?? item.price_feed_id ?? item.id ?? 0,
        symbol: (item.symbol ?? "").trim(),
        name: item.name ?? item.symbol ?? "",
        description: item.description ?? item.name ?? item.symbol ?? "",
      })
    )
    .filter((item: SymbolResult) => item.id > 0 && item.symbol.length > 0);
}

function loadSymbols(): Promise<void> {
  if (cachedSymbols) return Promise.resolve();
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/pyth-symbols?query=")
    .then((res) => (res.ok ? res.json() : []))
    .then((data) => {
      cachedSymbols = normalizeItems(data);
    })
    .catch(() => { fetchPromise = null; });
  return fetchPromise;
}

/** Prefetch symbol catalog on idle so first paint is not competing with history + SSE. */
function scheduleSymbolCatalogPrefetch() {
  const run = () => {
    void loadSymbols();
  };
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(run, { timeout: 4000 });
  } else {
    window.setTimeout(run, 1500);
  }
}

if (typeof window !== "undefined") {
  scheduleSymbolCatalogPrefetch();
}

async function searchSymbols(query: string, signal: AbortSignal): Promise<SymbolResult[]> {
  const res = await fetch(`/api/pyth-symbols?query=${encodeURIComponent(query)}`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) return [];
  const data = await res.json();
  return normalizeItems(data).slice(0, MAX_SEARCH_RESULTS);
}

function filterSymbols(query: string): SymbolResult[] {
  if (!cachedSymbols) return [];
  const q = query.toLowerCase();
  return cachedSymbols
    .filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    )
    .slice(0, MAX_SEARCH_RESULTS);
}

const RECENTS_KEY = "orra-recent-assets";
const MAX_RECENTS = 4;

function getRecents(): SymbolResult[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    devWarn("asset-search:get-recents", e);
    return [];
  }
}

function saveRecent(item: SymbolResult) {
  try {
    const existing = getRecents().filter((r) => r.id !== item.id);
    const updated = [item, ...existing].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  } catch (e) {
    devWarn("asset-search:save-recent", e);
  }
}

function removeRecent(id: number) {
  try {
    const updated = getRecents().filter((r) => r.id !== id);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  } catch (e) {
    devWarn("asset-search:remove-recent", e);
  }
}

const ORACLE_PICK_SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD", "XRP/USD", "AAPL/USD", "GOLD/USD", "EUR/USD"];

function getOraclePicks(recentIds: Set<number>): SymbolResult[] {
  if (!cachedSymbols) return [];
  return ORACLE_PICK_SYMBOLS
    .map((sym) => cachedSymbols!.find((s) => s.symbol === sym || s.symbol === `Crypto.${sym}` || s.name === sym))
    .filter((s): s is SymbolResult => !!s && !recentIds.has(s.id))
    .slice(0, 5);
}

const PLACEHOLDERS = [
  "speak the name of your market...",
  "what does the oracle seek today...",
  "name the asset you wish to divine...",
  "which price does the oracle read for you...",
  "tell the oracle where to look...",
  "what market calls to you...",
  "which asset weighs on your mind...",
];

export function AssetSearch({
  onSelect,
  whisperMap,
  onResultsVisible,
  variant = "default",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [recents, setRecents] = useState<SymbolResult[]>([]);
  const [picks, setPicks] = useState<SymbolResult[]>([]);
  const [isClosing, setIsClosing] = useState(false);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nowMs = useWallClockMs();
  const placeholderIdx = Math.floor(nowMs / 10_000) % PLACEHOLDERS.length;
  const phFading = nowMs % 10_000 >= 9_600;

  const handleFocus = useCallback(() => {
    setFocused(true);
    const r = getRecents();
    setRecents(r);
    setIsOpen(true);

    const applyBrowse = () => {
      const p = getOraclePicks(new Set(r.map((x) => x.id)));
      setPicks(p);
      if (onResultsVisible) onResultsVisible([...r, ...p].map((x) => x.id));
      if (query.length > 0) setResults(filterSymbols(query));
    };

    if (cachedSymbols) {
      applyBrowse();
      return;
    }

    setCatalogLoading(true);
    loadSymbols()
      .then(applyBrowse)
      .finally(() => setCatalogLoading(false));
  }, [query, onResultsVisible]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    blurRef.current = setTimeout(() => setIsOpen(false), 150);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (value.length < 1) {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      setResults([]);
      setIsOpen(true);
      return;
    }
    setIsOpen(true);

    if (cachedSymbols) {
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      const filtered = filterSymbols(value);
      setResults(filtered);
      if (onResultsVisible) onResultsVisible(filtered.map((x) => x.id));
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++searchRequestRef.current;
      searchSymbols(value, controller.signal)
        .then((items) => {
          if (searchRequestRef.current !== requestId) return;
          abortRef.current = null;
          setResults(items);
          if (onResultsVisible) onResultsVisible(items.map((x) => x.id));
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          if (searchRequestRef.current !== requestId) return;
          setResults([]);
        });
    }, 300);
  }, [onResultsVisible]);

  const handleSelect = useCallback((item: SymbolResult) => {
    if (isClosing) return;
    if (blurRef.current) clearTimeout(blurRef.current);
    if (closeRef.current) clearTimeout(closeRef.current);
    saveRecent(item);
    onSelect(item.id, item.symbol, item.name);
    setQuery("");
    setResults([]);
    setIsClosing(true);
    closeRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      closeRef.current = null;
    }, 120);
  }, [onSelect, isClosing]);

  const handleMouseDown = useCallback(() => { if (blurRef.current) clearTimeout(blurRef.current); }, []);

  const [removingId, setRemovingId] = useState<number | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const handleRemoveRecent = useCallback((id: number) => {
    setRemovingId(id);
    setTimeout(() => {
      removeRecent(id);
      const r = getRecents();
      setRecents(r);
      setPicks(getOraclePicks(new Set(r.map((x) => x.id))));
      setRemovingId(null);
    }, 300);
  }, []);

  const active = focused || query.length > 0;
  const showBrowse = isOpen && query.length === 0;
  const showSearch = isOpen && query.length > 0 && results.length > 0;
  const dropdownClass =
    variant === "cosmic"
      ? "absolute top-full left-1/2 z-[120] mt-1 w-[392px] max-w-full -translate-x-1/2"
      : "absolute top-full left-0 z-[120] mt-2 w-full";

  /** Reading cosmic dropdown: keep first content flush under the search bar */
  const browseTopPad = variant === "cosmic" ? "pt-1.5" : "pt-3";
  const picksHeaderTopPad = variant === "cosmic" ? "pt-2" : "pt-3";
  const picksHeaderTopWhenFirst =
    variant === "cosmic" ? "pt-1.5" : "pt-3";

  const inputProps = {
    type: "text" as const,
    value: query,
    onChange: (e: ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value),
    onFocus: handleFocus,
    onBlur: handleBlur,
    "aria-label": "Search oracle realms and markets",
  };

  return (
    <div
      className={`relative z-10 overflow-visible ${variant === "cosmic" ? "w-full max-w-[420px]" : "w-full sm:w-auto"}`}
    >
      {variant === "cosmic" ? (
        <div className="cosmic-search flex w-full items-center justify-center overflow-visible">
          <div className={`cosmic-search__main relative w-full max-w-[392px]${isClosing ? " cosmic-search__main--confirming" : ""}`}>
            <div className="cosmic-search__nebula pointer-events-none" aria-hidden />
            <div className="cosmic-search__starfield pointer-events-none" aria-hidden />
            <div className="cosmic-search__cosmic-ring pointer-events-none" aria-hidden />
            <div className="cosmic-search__stardust pointer-events-none" aria-hidden />
            <div className="cosmic-search__field-fill pointer-events-none" aria-hidden />
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="cosmic-search__icon-left pointer-events-none"
              aria-hidden
              style={{ color: active ? "var(--accent-light)" : "var(--ink-400)", transition: "color 0.15s" }}
            >
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {query.length === 0 && (
              <span
                className="cosmic-search__placeholder asset-search-placeholder absolute top-1/2 text-[13px] font-medium italic tracking-wide pointer-events-none select-none"
                style={{
                  left: "59px",
                  right: "52px",
                  opacity: phFading ? 0 : 1,
                  transform: `translateY(-50%) translateY(${phFading ? 4 : 0}px)`,
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                }}
              >
                {PLACEHOLDERS[placeholderIdx]}
              </span>
            )}
            <div className="cosmic-search__wormhole-border pointer-events-none" aria-hidden />
            <div className="cosmic-search__wormhole-face pointer-events-none" aria-hidden>
              <Sparkles
                className="cosmic-search__sparkles-icon"
                size={20}
                strokeWidth={1.5}
                aria-hidden
              />
            </div>
            <input
              {...inputProps}
              data-empty={query.length === 0 ? "true" : "false"}
              className="cosmic-search__input w-full text-[13px] font-medium focus:outline-none"
            />
          </div>
        </div>
      ) : (
      <div
        className={`asset-search-shell relative rounded-xl bg-surface-2 p-[3px] w-full sm:w-auto${isClosing ? " asset-search-shell--confirming" : ""}`}
        style={{
          boxShadow: "inset 0 2px 4px rgba(26,18,37,0.08), inset 0 1px 2px rgba(26,18,37,0.04)",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: active ? "var(--accent)" : "var(--ink-400)", transition: "color 0.15s" }}>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {query.length === 0 && (
          <span
            className="asset-search-placeholder absolute left-10 top-1/2 -translate-y-1/2 text-xs font-medium italic tracking-wide pointer-events-none select-none"
            style={{
              color: "var(--ink-400)",
              opacity: phFading ? 0 : 1,
              transform: `translateY(-50%) translateY(${phFading ? 4 : 0}px)`,
              transition: "opacity 0.4s ease, transform 0.4s ease",
            }}
          >
            {PLACEHOLDERS[placeholderIdx]}
          </span>
        )}
        <input
          {...inputProps}
          className="asset-search-input w-full sm:w-[340px] pl-8 pr-3 py-1 text-xs font-medium rounded-[9px] text-ink-900 focus:outline-none focus:ring-0 focus:shadow-none transition-all duration-200 border-none outline-none ring-0"
          style={{
            backgroundColor: "transparent",
            boxShadow: "none",
            caretColor: "var(--ink-900)",
          }}
        />
      </div>
      )}

      {showBrowse && (
        <div
          className={dropdownClass}
          onMouseDown={handleMouseDown}
          role="listbox"
          aria-label="Browse oracle markets"
        >
          <div className={`asset-search-dropdown-panel card-surface card-surface-static !rounded-xl overflow-x-hidden overflow-y-auto !p-0 max-h-[60vh]${isClosing ? " asset-search-dropdown-panel--closing" : ""}${variant === "cosmic" ? " asset-search-dropdown-panel--reading-cosmic" : ""}`}>
            {recents.length > 0 && (
              <div className={`px-4 pb-2 ${browseTopPad}`}>
                <span className="text-[9px] font-semibold uppercase tracking-widest text-ink-300">Recent</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {recents.map((item) => (
                    <div key={`r-${item.id}`}
                      className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-lg group asset-search-recent-chip"
                      style={{
                        backgroundColor: "var(--surface-3)",
                        opacity: removingId === item.id ? 0 : 1,
                        transform: removingId === item.id ? "scale(0.8)" : "scale(1)",
                        maxWidth: removingId === item.id ? "0px" : "200px",
                        padding: removingId === item.id ? "0" : undefined,
                        margin: removingId === item.id ? "0" : undefined,
                        overflow: "hidden",
                      }}
                      onMouseEnter={(e) => { if (removingId !== item.id) e.currentTarget.style.backgroundColor = "var(--surface-4)"; }}
                      onMouseLeave={(e) => { if (removingId !== item.id) e.currentTarget.style.backgroundColor = "var(--surface-3)"; }}
                    >
                      <button
                        onClick={() => handleSelect(item)}
                        className="text-[10px] font-bold tabular-nums tracking-wide"
                        style={{ color: "var(--ink-700)" }}
                      >
                        {item.name}
                      </button>
                      <button
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.stopPropagation(); handleRemoveRecent(item.id); }}
                        className="text-ink-300 hover:text-ink-700 transition-colors duration-100 ml-0.5"
                        style={{ fontSize: "10px", lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {picks.length > 0 && (
              <>
                <div
                  className={`px-4 pb-1.5 ${recents.length > 0 ? picksHeaderTopPad : picksHeaderTopWhenFirst}`}
                >
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-ink-300">Oracle&apos;s Picks</span>
                </div>
                {picks.map((item, i) => {
                  const w = whisperMap?.get(item.id);
                  return (
                    <button key={`p-${item.id}`}
                      onClick={() => handleSelect(item)}
                      className="w-full px-4 py-2 text-left flex items-center justify-between transition-all duration-150"
                      style={{
                        backgroundColor: "transparent",
                        borderBottom: i < picks.length - 1 ? "1px solid var(--surface-3)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "var(--surface-3)";
                        e.currentTarget.style.boxShadow = "inset 2px 0 0 color-mix(in srgb, var(--accent-light) 65%, transparent)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-bold tabular-nums text-ink-900 tracking-wide">{item.description}</span>
                        {w && (
                          <span className={`qflow-whisper qflow-whisper--${w.clarityClass}`}>
                            {w.whisper} {w.publisherCount > 0 && <span className="text-ink-400">● {w.publisherCount} publishers</span>}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-ink-400 truncate ml-3">{item.name}</span>
                    </button>
                  );
                })}
              </>
            )}
            {!catalogLoading && cachedSymbols && recents.length === 0 && picks.length === 0 && (
              <div className={`px-4 ${variant === "cosmic" ? "py-2" : "py-3.5"}`}>
                <p className="text-[11px] font-medium text-ink-500 leading-relaxed">
                  Type a name or ticker — the oracle will search live markets.
                </p>
              </div>
            )}
            {!catalogLoading && !cachedSymbols && recents.length === 0 && picks.length === 0 && (
              <div className={`px-4 ${variant === "cosmic" ? "py-2" : "py-3.5"}`}>
                <p className="text-[11px] font-medium text-ink-500 leading-relaxed">
                  Catalog unavailable — type to search; results load from the network.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showSearch && (
        <div
          className={dropdownClass}
          onMouseDown={handleMouseDown}
        >
          <ul className={`asset-search-dropdown-panel card-surface card-surface-static !rounded-xl overflow-x-hidden overflow-y-auto !p-0 max-h-[60vh]${isClosing ? " asset-search-dropdown-panel--closing" : ""}${variant === "cosmic" ? " asset-search-dropdown-panel--reading-cosmic" : ""}`}>
            {results.map((item, i) => {
              const w = whisperMap?.get(item.id);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleSelect(item)}
                    className="w-full px-4 py-2.5 text-left flex items-center justify-between transition-all duration-150"
                    style={{
                      backgroundColor: "transparent",
                      borderBottom: i < results.length - 1 ? "1px solid var(--surface-3)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--surface-3)";
                      e.currentTarget.style.boxShadow = "inset 2px 0 0 color-mix(in srgb, var(--accent-light) 65%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-bold tabular-nums text-ink-900 tracking-wide">{item.description}</span>
                      {w && (
                        <span className={`qflow-whisper qflow-whisper--${w.clarityClass}`}>
                          {w.whisper} {w.publisherCount > 0 && <span className="text-ink-400">● {w.publisherCount} publishers</span>}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-ink-400 truncate ml-3">{item.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";

interface SymbolResult {
  id: number;
  symbol: string;
  name: string;
}

interface Props {
  onSelect: (feedId: number, symbol: string, name: string) => void;
}

let cachedSymbols: SymbolResult[] | null = null;
let fetchPromise: Promise<void> | null = null;

function loadSymbols(): Promise<void> {
  if (cachedSymbols) return Promise.resolve();
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch("/api/pyth-symbols?query=")
    .then((res) => (res.ok ? res.json() : []))
    .then((data) => {
      const items = Array.isArray(data) ? data : data.results ?? [];
      cachedSymbols = items.map(
        (item: { pyth_lazer_id?: number; id?: number; symbol?: string; name?: string }) => ({
          id: item.pyth_lazer_id ?? item.id ?? 0,
          symbol: item.symbol ?? "",
          name: item.name ?? item.symbol ?? "",
        })
      );
    })
    .catch(() => { fetchPromise = null; });
  return fetchPromise;
}

function filterSymbols(query: string): SymbolResult[] {
  if (!cachedSymbols) return [];
  const q = query.toLowerCase();
  return cachedSymbols
    .filter((s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    .slice(0, 8);
}

export function AssetSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFocus = useCallback(() => {
    loadSymbols().then(() => {
      if (query.length > 0) {
        setResults(filterSymbols(query));
        setIsOpen(true);
      }
    });
  }, [query]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    if (value.length < 1) { setResults([]); setIsOpen(false); return; }
    if (cachedSymbols) { setResults(filterSymbols(value)); setIsOpen(true); }
    else { loadSymbols().then(() => { setResults(filterSymbols(value)); setIsOpen(true); }); }
  }, []);

  const handleSelect = useCallback((item: SymbolResult) => {
    setQuery(""); setIsOpen(false); setResults([]);
    onSelect(item.id, item.symbol, item.name);
  }, [onSelect]);

  const handleBlur = useCallback(() => { blurRef.current = setTimeout(() => setIsOpen(false), 150); }, []);
  const handleMouseDown = useCallback(() => { if (blurRef.current) clearTimeout(blurRef.current); }, []);

  return (
    <div className="relative z-50">
      <div className="relative">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search asset..."
          className="w-[320px] pl-10 pr-3.5 py-2.5 text-[12px] font-medium bg-surface-1 border border-surface-3 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-accent/30 focus:ring-2 focus:ring-accent/10 transition-all shadow-sm"
        />
      </div>
      {isOpen && results.length > 0 && (
        <ul
          className="absolute top-full left-0 right-0 mt-1.5 bg-surface-1 border border-surface-3 rounded-xl shadow-lg overflow-hidden"
          onMouseDown={handleMouseDown}
        >
          {results.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleSelect(item)}
                className="w-full px-3.5 py-2.5 text-left flex items-center justify-between hover:bg-surface-2 transition-colors duration-150"
              >
                <span className="text-[12px] font-semibold text-ink-900">{item.symbol}</span>
                <span className="text-[10px] font-medium text-ink-400 truncate ml-2">{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

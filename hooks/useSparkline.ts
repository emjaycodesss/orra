import { useSyncExternalStore, useRef } from "react";

type Listener = () => void;

export type TimeRange = "daily" | "weekly" | "monthly";

export interface SparklinePoint {
  time: number;
  close: number;
}

const EMPTY: SparklinePoint[] = [];

interface CacheEntry {
  data: SparklinePoint[];
  timestamp: number;
}

const CACHE_TTL: Record<TimeRange, number> = {
  daily: 30_000,
  weekly: 60_000,
  monthly: 120_000,
};

class SparklineStore {
  private data: SparklinePoint[] = EMPTY;
  private listeners = new Set<Listener>();
  private currentKey: string | null = null;
  private fetching = false;
  private cache = new Map<string, CacheEntry>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.data;
  getServerSnapshot = () => EMPTY;

  fetch(symbol: string, range: TimeRange) {
    const key = `${symbol}:${range}`;
    if (this.currentKey === key && this.data !== EMPTY) return;

    // Check cache first — set data synchronously (safe, no notify needed if same ref)
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < (CACHE_TTL[range] ?? 30_000)) {
      this.currentKey = key;
      this.data = cached.data;
      this.fetching = false;
      // Defer notify to avoid setState-during-render
      queueMicrotask(() => this.notify());
      return;
    }

    if (this.currentKey !== key) {
      this.currentKey = key;
      if (cached) {
        this.data = cached.data;
      } else {
        this.data = EMPTY;
      }
      this.fetching = false;
      queueMicrotask(() => this.notify());
    }
    if (!this.fetching) {
      this.fetchData(symbol, range, key);
    }
  }

  private async fetchData(symbol: string, range: TimeRange, key: string) {
    this.fetching = true;

    try {
      const res = await fetch(
        `/api/pyth-history?symbol=${encodeURIComponent(symbol)}&range=${range}`
      );
      if (res.ok && this.currentKey === key) {
        const json = await res.json();
        let points: SparklinePoint[] = EMPTY;
        if (Array.isArray(json) && json.length > 0) {
          points = json.map((p: { t: number; c: number }) => ({ time: p.t, close: p.c }));
        } else if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          points = json.data.map((p: { t: number; c: number }) => ({ time: p.t, close: p.c }));
        }
        if (points !== EMPTY) {
          this.data = points;
          this.cache.set(key, { data: points, timestamp: Date.now() });
          this.notify();
        }
      }
    } catch {
      // ignore
    } finally {
      this.fetching = false;
    }
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

const store = new SparklineStore();

export function useSparkline(symbol: string, range: TimeRange) {
  const prevRef = useRef(`${symbol}:${range}`);
  const key = `${symbol}:${range}`;

  if (prevRef.current !== key) {
    prevRef.current = key;
    store.fetch(symbol, range);
  }

  if (store.getSnapshot() === EMPTY && symbol && typeof window !== "undefined") {
    store.fetch(symbol, range);
  }

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
}

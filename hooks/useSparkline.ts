import { useSyncExternalStore, useRef, useCallback } from "react";

type Listener = () => void;

export type TimeRange = "daily" | "weekly" | "monthly";
export type SparklineStatus = "loading" | "ready" | "empty";

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
  daily: 300_000,
  weekly: 600_000,
  monthly: 1_200_000,
};

class SparklineStore {
  private data: SparklinePoint[] = EMPTY;
  private status: SparklineStatus = "loading";
  private listeners = new Set<Listener>();
  private currentKey: string | null = null;
  private fetching = false;
  private cache = new Map<string, CacheEntry>();
  private abortController: AbortController | null = null;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.data;
  getStatusSnapshot = (): SparklineStatus => this.status;

  getServerSnapshot = () => EMPTY;
  private static SERVER_STATUS: SparklineStatus = "loading";
  getServerStatusSnapshot = (): SparklineStatus => SparklineStore.SERVER_STATUS;

  getCurrentKey() {
    return this.currentKey;
  }

  fetch(symbol: string, range: TimeRange) {
    const key = `${symbol}:${range}`;
    if (this.currentKey === key && this.data !== EMPTY) return;

    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < (CACHE_TTL[range] ?? 30_000)) {
      this.currentKey = key;
      this.data = cached.data;
      this.status = "ready";
      this.fetching = false;
      queueMicrotask(() => this.notify());
      return;
    }

    if (this.currentKey !== key) {
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
      this.currentKey = key;
      this.data = cached ? cached.data : EMPTY;
      this.status = "loading";
      this.fetching = false;
      queueMicrotask(() => this.notify());
    }
    if (!this.fetching) {
      this.fetchData(symbol, range, key);
    }
  }

  private async fetchData(symbol: string, range: TimeRange, key: string) {
    this.fetching = true;
    const controller = new AbortController();
    this.abortController = controller;

    try {
      const res = await fetch(
        `/api/pyth-history?symbol=${encodeURIComponent(symbol)}&range=${range}`,
        { signal: controller.signal }
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
          this.status = "ready";
          this.cache.set(key, { data: points, timestamp: Date.now() });
          this.notify();
        } else {
          this.status = "empty";
          this.notify();
        }
      } else if (this.currentKey === key) {
        this.status = "empty";
        this.notify();
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (this.currentKey === key) {
        this.status = "empty";
        this.notify();
      }
    } finally {
      if (this.abortController === controller) this.abortController = null;
      this.fetching = false;
    }
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

const store = new SparklineStore();

export function useSparkline(symbol: string, range: TimeRange): { data: SparklinePoint[]; status: SparklineStatus } {
  const keyRef = useRef(`${symbol}:${range}`);
  keyRef.current = `${symbol}:${range}`;
  store.fetch(symbol, range);

  const getSnapshot = useCallback(() => {
    const data = store.getSnapshot();
    if (store.getCurrentKey() !== keyRef.current) return EMPTY;
    return data;
  }, []);

  const getStatusSnapshot = useCallback((): SparklineStatus => {
    if (store.getCurrentKey() !== keyRef.current) return "loading";
    return store.getStatusSnapshot();
  }, []);

  const data = useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    store.getServerSnapshot
  );

  const status = useSyncExternalStore(
    store.subscribe,
    getStatusSnapshot,
    store.getServerStatusSnapshot
  );

  return { data, status };
}

"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PythStreamData } from "@/lib/oracleState";

interface ConfidencePoint {
  t: number;
  conf: number;
  price: number;
}

const MAX_POINTS = 7200;

type Listener = () => void;

interface HistoryState {
  history: ConfidencePoint[];
  lastTs: number;
  backfillKey: string | null;
}

class ConfidenceHistoryStore {
  private listeners = new Set<Listener>();
  private stateByKey = new Map<string, HistoryState>();
  private activeKey = "";
  private inflight = new Set<string>();
  private notifyPending = false;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ConfidencePoint[] => {
    return this.stateByKey.get(this.activeKey)?.history ?? [];
  };

  getServerSnapshot = (): ConfidencePoint[] => [];

  private ensureState(key: string): HistoryState {
    const existing = this.stateByKey.get(key);
    if (existing) return existing;
    const next: HistoryState = { history: [], lastTs: 0, backfillKey: null };
    this.stateByKey.set(key, next);
    return next;
  }

  setInput(key: string, data: PythStreamData | null, assetSymbol?: string, hours: number = 1) {
    this.activeKey = key;
    const state = this.ensureState(key);

    if (assetSymbol && state.backfillKey !== key && !this.inflight.has(key)) {
      state.backfillKey = key;
      this.inflight.add(key);
      fetch(`/api/pyth-confidence-history?symbol=${encodeURIComponent(assetSymbol)}&hours=${hours}`)
        .then((res) => (res.ok ? res.json() : []))
        .then((points: ConfidencePoint[]) => {
          if (!Array.isArray(points) || points.length === 0) return;
          const target = this.ensureState(key);
          const liveStart = target.history.length > 0 ? target.history[0].t : Infinity;
          const historical = points.filter((p) => p.t < liveStart);
          if (historical.length > 0) {
            target.history = [...historical, ...target.history].slice(-MAX_POINTS);
            this.scheduleNotify();
          }
        })
        .catch(() => {})
        .finally(() => {
          this.inflight.delete(key);
        });
    }

    if (!data) return;
    const now = Date.now();
    if (now - state.lastTs < 900) return;

    const exp = 10 ** data.exponent;
    const price = Number(data.price) * exp;
    const conf = Number(data.confidence) * exp;
    const absPrice = Math.abs(price);
    const confPct = absPrice > 0 ? (conf / absPrice) * 100 : 0;

    state.lastTs = now;
    state.history = [...state.history, { t: now, conf: confPct, price }].slice(-MAX_POINTS);
    this.scheduleNotify();
  }

  reset(key: string) {
    this.stateByKey.set(key, { history: [], lastTs: 0, backfillKey: null });
    this.scheduleNotify();
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private scheduleNotify() {
    if (this.notifyPending) return;
    this.notifyPending = true;
    queueMicrotask(() => {
      this.notifyPending = false;
      this.notify();
    });
  }
}

const store = new ConfidenceHistoryStore();

export function useConfidenceHistory(
  data: PythStreamData | null,
  assetSymbol?: string,
  hours: number = 1
) {
  const key = `${assetSymbol ?? ""}:${hours}`;
  store.setInput(key, data, assetSymbol, hours);

  const history = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );

  const reset = useCallback(() => {
    store.reset(key);
  }, [key]);

  return { history, reset };
}

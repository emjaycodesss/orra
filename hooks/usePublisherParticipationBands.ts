"use client";

import { useSyncExternalStore } from "react";
import type { PythStreamData } from "@/lib/oracleState";

const MAX_SAMPLES = 120;
const MIN_SAMPLES_FOR_RELATIVE = 8;
const THROTTLE_MS = 1500;

type Listener = () => void;

interface FeedState {
  samples: number[];
  lastAppendMs: number;
  lastAppendedValue: number | null;
}

class PublisherParticipationStore {
  private listeners = new Set<Listener>();
  private byKey = new Map<string, FeedState>();
  private activeKey = "";
  private latestByKey = new Map<string, { count: number; hasLive: boolean }>();
  private notifyPending = false;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

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

  private ensure(key: string): FeedState {
    let s = this.byKey.get(key);
    if (!s) {
      s = { samples: [], lastAppendMs: 0, lastAppendedValue: null };
      this.byKey.set(key, s);
    }
    return s;
  }

  setInput(key: string, publisherCount: number, hasLiveOracle: boolean) {
    const prevLatest = this.latestByKey.get(key);
    this.activeKey = key;
    this.latestByKey.set(key, { count: publisherCount, hasLive: hasLiveOracle });

    const liveChanged =
      !prevLatest ||
      prevLatest.count !== publisherCount ||
      prevLatest.hasLive !== hasLiveOracle;

    let appended = false;
    if (hasLiveOracle && publisherCount > 0) {
      const state = this.ensure(key);
      const now = Date.now();
      const shouldAppend =
        state.samples.length === 0 ||
        now - state.lastAppendMs >= THROTTLE_MS ||
        publisherCount !== state.lastAppendedValue;

      if (shouldAppend) {
        state.samples = [...state.samples, publisherCount].slice(-MAX_SAMPLES);
        state.lastAppendMs = now;
        state.lastAppendedValue = publisherCount;
        appended = true;
      }
    }

    if (liveChanged || appended) this.scheduleNotify();
  }

  private getLabel(key: string, publisherCount: number, hasLiveOracle: boolean): string {
    if (!hasLiveOracle || publisherCount <= 0) return "--";

    const state = this.byKey.get(key);
    const samples = state?.samples ?? [];

    if (samples.length < MIN_SAMPLES_FOR_RELATIVE) {
      return fallbackAbsoluteLabel(publisherCount);
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const p25 = quantile(sorted, 0.25);
    const p75 = quantile(sorted, 0.75);

    if (publisherCount >= p75) return "Strong consensus";
    if (publisherCount >= p25) return "Moderate consensus";
    return "Low consensus";
  }

  getSnapshot = (): string => {
    const latest = this.latestByKey.get(this.activeKey);
    if (!latest) return "--";
    return this.getLabel(this.activeKey, latest.count, latest.hasLive);
  };

  getServerSnapshot = (): string => "--";
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function fallbackAbsoluteLabel(count: number): string {
  if (count >= 10) return "Strong consensus";
  if (count >= 5) return "Moderate consensus";
  return "Low consensus";
}

const store = new PublisherParticipationStore();

export function usePublisherParticipationBands(
  liveData: PythStreamData | null,
  publisherCount: number,
  hasLiveOracle: boolean
): string {
  const key =
    liveData && liveData.priceFeedId > 0 ? String(liveData.priceFeedId) : "inactive";

  store.setInput(key, publisherCount, hasLiveOracle);

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
}

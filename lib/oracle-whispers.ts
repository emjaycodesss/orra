import type { SignalClarity } from "./oracleState";
import { devWarn } from "@/lib/dev-warn";

export function whisperText(clarity: SignalClarity): string {
  switch (clarity) {
    case "tight":
      return "The oracle sees clearly";
    case "moderate":
      return "The signal is present";
    case "wide":
      return "The oracle speaks in riddles";
    case "extreme":
      return "Chaos clouds the vision";
  }
}

export const STALE_WHISPER = "The market sleeps";

export interface WhisperData {
  signalClarity: SignalClarity;
  whisper: string;
  publisherCount: number;
  isStale: boolean;
  observedAtMs: number;
}

type Listener = () => void;

class OracleWhisperStore {
  private static readonly REFRESH_MS = 8_000;
  private static readonly FETCH_TIMEOUT_MS = 10_000;
  private static readonly STALE_THRESHOLD_MS = 15_000;
  private cache = new Map<number, WhisperData>();
  private snapshot = new Map<number, WhisperData>();
  private listeners = new Set<Listener>();
  private activeSources = new Map<number, EventSource>();
  private pendingFeeds = new Set<number>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): Map<number, WhisperData> => this.snapshot;

  private static SERVER_SNAPSHOT = new Map<number, WhisperData>();
  getServerSnapshot = (): Map<number, WhisperData> =>
    OracleWhisperStore.SERVER_SNAPSHOT;

  fetchWhispers(feedIds: number[]): void {
    for (const id of feedIds) {
      if (id <= 0) continue;
      const cached = this.cache.get(id);
      if (
        cached &&
        !cached.isStale &&
        Date.now() - cached.observedAtMs < OracleWhisperStore.REFRESH_MS
      ) continue;
      if (this.pendingFeeds.has(id)) continue;
      this.pendingFeeds.add(id);
      this.connectBriefly(id);
    }
  }

  private toEpochMs(tsRaw: unknown): number {
    const ts = Number(tsRaw ?? 0);
    if (!Number.isFinite(ts) || ts <= 0) return 0;
    if (ts > 1e14) return Math.floor(ts / 1000);
    if (ts > 1e11) return Math.floor(ts);
    if (ts > 1e9) return Math.floor(ts * 1000);
    return 0;
  }

  private connectBriefly(feedId: number): void {
    if (typeof window === "undefined") return;

    const es = new EventSource(`/api/pyth-stream?feedId=${feedId}`);
    this.activeSources.set(feedId, es);

    const timeout = setTimeout(() => {
      if (!this.cache.has(feedId)) {
        this.cache.set(feedId, {
          signalClarity: "tight",
          whisper: STALE_WHISPER,
          publisherCount: 0,
          isStale: true,
          observedAtMs: Date.now(),
        });
        this.notify();
      }
      this.cleanup(feedId);
    }, OracleWhisperStore.FETCH_TIMEOUT_MS);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const exp = 10 ** (data.exponent ?? -8);
        const price = Number(data.price ?? 0) * exp;
        const conf = Number(data.confidence ?? 0) * exp;
        const absPrice = Math.abs(price);
        const pct = absPrice > 0 ? (conf / absPrice) * 100 : 0;

        let clarity: SignalClarity;
        if (pct < 0.5) clarity = "tight";
        else if (pct < 1) clarity = "moderate";
        else if (pct < 2) clarity = "wide";
        else clarity = "extreme";

        const publishers = Number(data.publisherCount ?? 0);
        const feedTsMs = this.toEpochMs(data.feedUpdateTimestamp);
        const isStale = feedTsMs > 0
          ? Date.now() - feedTsMs > OracleWhisperStore.STALE_THRESHOLD_MS
          : true;

        this.cache.set(feedId, {
          signalClarity: clarity,
          whisper: isStale ? STALE_WHISPER : whisperText(clarity),
          publisherCount: publishers,
          isStale,
          observedAtMs: Date.now(),
        });
        this.notify();

        if (!isStale) {
          clearTimeout(timeout);
          this.cleanup(feedId);
        }
      } catch (e) {
        devWarn(`oracle-whispers:feed-${feedId}`, e);
      }
    };

    es.onerror = () => {
      clearTimeout(timeout);
      if (!this.cache.has(feedId)) {
        this.cache.set(feedId, {
          signalClarity: "tight",
          whisper: STALE_WHISPER,
          publisherCount: 0,
          isStale: true,
          observedAtMs: Date.now(),
        });
        this.notify();
      }
      this.cleanup(feedId);
    };
  }

  private cleanup(feedId: number): void {
    const es = this.activeSources.get(feedId);
    if (es) {
      es.close();
      this.activeSources.delete(feedId);
    }
    this.pendingFeeds.delete(feedId);
  }

  private notify(): void {
    this.snapshot = new Map(this.cache);
    this.listeners.forEach((l) => l());
  }
}

export const oracleWhisperStore = new OracleWhisperStore();

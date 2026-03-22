import { useSyncExternalStore, useRef } from "react";
import type { PythStreamData } from "@/lib/weather";

type Listener = () => void;

class PythStreamStore {
  private data: PythStreamData | null = null;
  private listeners = new Set<Listener>();
  private eventSource: EventSource | null = null;
  private currentFeedId: number | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    if (this.currentFeedId !== null && !this.eventSource) {
      this.connect(this.currentFeedId);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.disconnect();
    };
  };

  getSnapshot = () => this.data;

  private static SERVER_SNAPSHOT: PythStreamData | null = null;
  getServerSnapshot = () => PythStreamStore.SERVER_SNAPSHOT;

  setFeed(feedId: number) {
    if (this.currentFeedId === feedId) return;
    this.disconnect();
    this.currentFeedId = feedId;
    this.data = null;
    queueMicrotask(() => this.notify());
    if (this.listeners.size > 0) this.connect(feedId);
  }

  private connect(feedId: number) {
    if (typeof window === "undefined") return;
    this.disconnect();
    this.currentFeedId = feedId;

    const es = new EventSource(`/api/pyth-stream?feedId=${feedId}`);
    this.eventSource = es;

    es.onmessage = (event) => {
      try {
        this.data = JSON.parse(event.data) as PythStreamData;
        this.notify();
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      es.close();
      this.eventSource = null;
      this.retryTimer = setTimeout(() => {
        if (this.currentFeedId === feedId && this.listeners.size > 0) {
          this.connect(feedId);
        }
      }, 5000);
    };
  }

  private disconnect() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.eventSource?.close();
    this.eventSource = null;
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

const store = new PythStreamStore();

export function usePythStream(feedId: number) {
  const prevRef = useRef(feedId);
  if (prevRef.current !== feedId) {
    prevRef.current = feedId;
    store.setFeed(feedId);
  }

  if (store.getSnapshot() === null && typeof window !== "undefined") {
    store.setFeed(feedId);
  }

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
}

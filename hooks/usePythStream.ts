import { useSyncExternalStore, useRef, useCallback } from "react";
import type { PythStreamData } from "@/lib/oracleState";
import { devWarn } from "@/lib/dev-warn";

type Listener = () => void;

type ConnectionStatus = 'connecting' | 'open' | 'error';

const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 5_000;

class PythStreamStore {
  private data: PythStreamData | null = null;
  private connectionStatus: ConnectionStatus = 'connecting';
  private listeners = new Set<Listener>();
  private eventSource: EventSource | null = null;
  private currentFeedId: number | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  /** When true, tab was hidden — ES is torn down to free HTTP/1.1 slots for other tabs/routes. */
  private pausedByVisibility = false;

  subscribe = (listener: Listener) => {
    installPythStreamVisibilityBridge();
    this.listeners.add(listener);
    if (this.currentFeedId !== null && !this.eventSource && !this.pausedByVisibility) {
      this.connect(this.currentFeedId);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.disconnect();
    };
  };

  getSnapshot = () => this.data;
  getStatusSnapshot = (): ConnectionStatus => this.connectionStatus;

  private static SERVER_SNAPSHOT: PythStreamData | null = null;
  private static SERVER_STATUS: ConnectionStatus = 'connecting';
  getServerSnapshot = () => PythStreamStore.SERVER_SNAPSHOT;
  getServerStatusSnapshot = (): ConnectionStatus => PythStreamStore.SERVER_STATUS;

  getCurrentFeedId() {
    return this.currentFeedId;
  }

  setFeed(feedId: number) {
    if (feedId <= 0) {
      if (this.currentFeedId === null && this.data === null) return;
      this.disconnect();
      this.currentFeedId = null;
      this.data = null;
      this.connectionStatus = 'connecting';
      queueMicrotask(() => this.notify());
      return;
    }
    if (this.currentFeedId === feedId) return;
    this.disconnect();
    this.currentFeedId = feedId;
    this.data = null;
    this.connectionStatus = 'connecting';
    queueMicrotask(() => this.notify());
    if (this.listeners.size > 0) this.connect(feedId);
  }

  /** Releases the long-lived SSE socket while the document is hidden (same-origin connection cap). */
  pauseForDocumentHidden() {
    this.pausedByVisibility = true;
    this.disconnect();
    this.connectionStatus = "connecting";
    this.notify();
  }

  resumeIfNeeded() {
    if (!this.pausedByVisibility) return;
    this.pausedByVisibility = false;
    if (this.listeners.size > 0 && this.currentFeedId != null && this.currentFeedId > 0) {
      this.connect(this.currentFeedId);
    }
  }

  private connect(feedId: number) {
    if (feedId <= 0) return;
    if (typeof window === "undefined") return;
    if (this.pausedByVisibility) return;
    this.disconnect();
    this.currentFeedId = feedId;

    const es = new EventSource(`/api/pyth-stream?feedId=${feedId}`);
    this.eventSource = es;

    es.onopen = () => {
      this.connectionStatus = 'open';
      this.notify();
    };

    es.onmessage = (event) => {
      try {
        this.data = JSON.parse(event.data) as PythStreamData;
        this.retryCount = 0;
        this.notify();
      } catch (e) {
        devWarn("pyth-stream:parse-sse", e);
      }
    };

    es.onerror = () => {
      es.close();
      this.eventSource = null;
      this.connectionStatus = 'error';
      this.notify();
      const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** this.retryCount);
      this.retryCount++;
      this.retryTimer = setTimeout(() => {
        if (this.currentFeedId === feedId && this.listeners.size > 0) {
          this.connectionStatus = 'connecting';
          this.notify();
          this.connect(feedId);
        }
      }, delay);
    };
  }

  private disconnect() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.eventSource?.close();
    this.eventSource = null;
    this.retryCount = 0;
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

const store = new PythStreamStore();

let pythVisibilityBridgeInstalled = false;
function installPythStreamVisibilityBridge() {
  if (pythVisibilityBridgeInstalled || typeof document === "undefined") return;
  pythVisibilityBridgeInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) store.pauseForDocumentHidden();
    else store.resumeIfNeeded();
  });
}

export function usePythStream(feedId: number) {
  const feedIdRef = useRef(feedId);
  feedIdRef.current = feedId;
  store.setFeed(feedId);

  const getSnapshot = useCallback(() => {
    const data = store.getSnapshot();
    if (!data) return null;
    if (data.priceFeedId !== feedIdRef.current) return null;
    return data;
  }, []);

  return useSyncExternalStore(
    store.subscribe,
    getSnapshot,
    store.getServerSnapshot
  );
}

export function usePythStreamStatus(): ConnectionStatus {
  return useSyncExternalStore(
    store.subscribe,
    store.getStatusSnapshot,
    store.getServerStatusSnapshot
  );
}

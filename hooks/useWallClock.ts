"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;

class WallClockStore {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private now = Date.now();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.now = Date.now();
        this.listeners.forEach((l) => l());
      }, 1000);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  };

  getSnapshot = () => this.now;
  getServerSnapshot = () => 0;
}

const wallClockStore = new WallClockStore();

export function useWallClockMs(): number {
  return useSyncExternalStore(
    wallClockStore.subscribe,
    wallClockStore.getSnapshot,
    wallClockStore.getServerSnapshot
  );
}


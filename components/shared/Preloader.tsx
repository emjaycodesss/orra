"use client";

import { useState, useCallback } from "react";
import { useSyncExternalStore } from "react";

type Listener = () => void;

class TimerStore {
  private done = false;
  private listeners = new Set<Listener>();

  constructor(ms: number) {
    if (typeof window !== "undefined") {
      setTimeout(() => { this.done = true; this.notify(); }, ms);
    }
  }

  subscribe = (l: Listener) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  getSnapshot = () => this.done;
  getServerSnapshot = () => true;
  private notify() { this.listeners.forEach((l) => l()); }
}

const timer = new TimerStore(2800);

export function Preloader({ children }: { children: React.ReactNode }) {
  const timerDone = useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getServerSnapshot);
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);

  const handleTransitionEnd = useCallback(() => {
    if (fadeOut) setHidden(true);
  }, [fadeOut]);

  if (timerDone && !fadeOut) setFadeOut(true);

  if (hidden) return <>{children}</>;

  return (
    <>
      <div
        className={`fixed inset-0 z-[999] flex flex-col items-center justify-center transition-opacity duration-500 ${fadeOut ? "opacity-0" : "opacity-100"}`}
        style={{ backgroundColor: "var(--surface-0)" }}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="preloader-circles">
          <div className="preloader-circle" />
          <div className="preloader-circle" />
          <div className="preloader-circle" />
          <div className="preloader-circle" />
          <div className="preloader-circle" />
        </div>
        <p className="preloader-text">the oracle awakens</p>
      </div>
      <div className="opacity-0">{children}</div>
    </>
  );
}

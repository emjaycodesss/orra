"use client";

import { useRef, useCallback } from "react";
import { useSyncExternalStore } from "react";

type Listener = () => void;

class TickStore {
  private frame = 0;
  private listeners = new Set<Listener>();
  private running = false;
  private rafId: number | null = null;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    if (!this.running) this.start();
    return () => {
      this.listeners.delete(l);
      if (this.listeners.size === 0) this.stop();
    };
  };

  getSnapshot = () => this.frame;
  getServerSnapshot = () => 0;

  private start() {
    this.running = true;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 80) {
        last = t;
        this.frame++;
        this.listeners.forEach((l) => l());
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stop() {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}

const tickStore = new TickStore();

const CHARS = ["~", "≈", "∿", "∼", "˜", "⌇", "·"];
const ROWS = 18;
const COLS = 60;

export function AsciiWaves() {
  const frame = useSyncExternalStore(tickStore.subscribe, tickStore.getSnapshot, tickStore.getServerSnapshot);
  const gridRef = useRef<string[][] | null>(null);

  if (!gridRef.current) {
    gridRef.current = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => CHARS[(r + c) % CHARS.length])
    );
  }

  const buildRow = useCallback((r: number, f: number) => {
    const chars: string[] = [];
    for (let c = 0; c < COLS; c++) {
      const wave = Math.sin((c * 0.15) + (r * 0.3) + (f * 0.08));
      const idx = Math.floor(((wave + 1) / 2) * (CHARS.length - 1));
      chars.push(CHARS[idx]);
    }
    return chars.join(" ");
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none select-none overflow-hidden z-[1]"
      aria-hidden="true">
      <pre
        className="absolute inset-0 flex flex-col justify-center items-center leading-[2.2] text-[11px]"
        style={{
          fontFamily: "monospace",
          color: "var(--accent)",
          opacity: 0.07,
        }}
      >
        {Array.from({ length: ROWS }, (_, r) => (
          <span key={r}>{buildRow(r, frame)}</span>
        ))}
      </pre>
    </div>
  );
}

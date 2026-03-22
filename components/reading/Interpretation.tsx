"use client";

import { useRef } from "react";
import { useSyncExternalStore } from "react";

type Listener = () => void;

class TypewriterStore {
  private text = "";
  private fullText = "";
  private index = 0;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.text;
  private static EMPTY = "";
  getServerSnapshot = () => TypewriterStore.EMPTY;

  start(fullText: string) {
    this.stop();
    this.fullText = fullText;
    this.index = 0;
    this.text = "";
    this.notify();
    this.timer = setInterval(() => {
      if (this.index < this.fullText.length) {
        this.text += this.fullText[this.index];
        this.index++;
        this.notify();
      } else { this.stop(); }
    }, 22);
  }

  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  private notify() { this.listeners.forEach((l) => l()); }
}

interface Props { text: string; }

export function Interpretation({ text }: Props) {
  const storeRef = useRef<TypewriterStore | null>(null);
  if (!storeRef.current) storeRef.current = new TypewriterStore();
  const store = storeRef.current;

  const startedRef = useRef(false);
  if (!startedRef.current && text) { startedRef.current = true; store.start(text); }

  const displayText = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  if (!text) return null;

  return (
    <div className="w-full max-w-md mx-auto opacity-0 animate-fade-up">
      <div className="card-surface px-6 py-5">
        <p className="text-[13px] font-normal text-ink-700 leading-[1.8] italic">
          {displayText}
          <span className="inline-block w-px h-[14px] bg-accent ml-0.5 animate-pulse" />
        </p>
      </div>
    </div>
  );
}

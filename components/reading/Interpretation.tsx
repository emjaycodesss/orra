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
  private onComplete: ((full: string) => void) | null = null;
  private completeFired = false;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    if (
      this.listeners.size === 1 &&
      this.fullText.length > 0 &&
      this.index < this.fullText.length &&
      this.timer === null
    ) {
      this.scheduleTickLoop();
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  };

  getSnapshot = () => this.text;
  private static EMPTY = "";
  getServerSnapshot = () => TypewriterStore.EMPTY;

  start(fullText: string, onComplete?: (full: string) => void) {
    this.stop();
    this.completeFired = false;
    this.fullText = fullText;
    this.onComplete = onComplete ?? null;
    this.index = 0;
    this.text = "";
    this.notify();
    if (fullText.length === 0) {
      return;
    }
    this.scheduleTickLoop();
  }

  private scheduleTickLoop() {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.tick(), 22);
  }

  private tick() {
    if (this.index < this.fullText.length) {
      this.text += this.fullText[this.index];
      this.index++;
      this.notify();
    } else {
      this.stop();
      if (!this.completeFired && this.onComplete) {
        this.completeFired = true;
        this.onComplete(this.fullText);
      }
      this.onComplete = null;
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

interface Props {
  text: string;
  onTypewriterComplete?: (fullText: string) => void;
  embedded?: boolean;
  /** Omit fade-up so the block is visible immediately after spread → reading handoff */
  instantSurface?: boolean;
}

export function Interpretation({
  text,
  onTypewriterComplete,
  embedded = false,
  instantSurface = false,
}: Props) {
  const storeRef = useRef<TypewriterStore | null>(null);
  if (!storeRef.current) storeRef.current = new TypewriterStore();
  const store = storeRef.current;

  const onDoneRef = useRef(onTypewriterComplete);
  onDoneRef.current = onTypewriterComplete;

  const startedRef = useRef(false);
  if (!startedRef.current && text) {
    startedRef.current = true;
    store.start(text, (full) => {
      onDoneRef.current?.(full);
    });
  }

  const displayText = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const body = (
    <>
      <p className="mb-3 text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-400">
        interpretation
      </p>
      {!text ? (
        <div className="py-1" aria-label="Generating interpretation…" aria-busy="true">
          <p className="text-[15px] sm:text-[16px] font-normal text-ink-500 leading-[1.85] italic animate-pulse">
            The oracle is reading the signs…
          </p>
          <div className="mt-4 flex flex-col gap-[10px]">
            <div className="h-[13px] rounded-full bg-ink-100/80 animate-pulse" style={{ width: "100%" }} />
            <div className="h-[13px] rounded-full bg-ink-100/80 animate-pulse" style={{ width: "88%" }} />
            <div className="h-[13px] rounded-full bg-ink-100/80 animate-pulse" style={{ width: "94%" }} />
          </div>
        </div>
      ) : (
        <p className="text-[15px] sm:text-[16px] font-normal text-ink-700 leading-[1.85] italic">
          {displayText}
          <span className="inline-block w-[1.5px] h-[1.1em] bg-accent ml-0.5 align-middle animate-pulse" />
        </p>
      )}
    </>
  );

  if (embedded) {
    return <div className="pt-1">{body}</div>;
  }

  return (
    <div
      className={
        instantSurface
          ? "w-full max-w-2xl mx-auto"
          : "w-full max-w-2xl mx-auto opacity-0 animate-fade-up"
      }
    >
      <div className="card-surface px-7 py-6">{body}</div>
    </div>
  );
}

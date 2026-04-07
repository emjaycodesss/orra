"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname } from "next/navigation";
import { useMountEffect } from "@/hooks/useMountEffect";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { ReadingAudioEngine } from "@/lib/reading-audio";

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export type ReadingAudioContextValue = {
  ready: boolean;
  beginAmbientFromReadingNav: () => Promise<void>;
  notifyEnterPortal: () => Promise<void>;
  startWalletShuffleLoop: () => void;
  stopWalletShuffleLoop: () => void;
  /** Nudge AudioContext out of suspended state (call from spread mount; schedule also does this). */
  primeAudioForSpread: () => void;
  scheduleSpreadDealShuffleBed: (opts: {
    staggerSec: number;
    durationSec: number;
    playbackRates: number[];
  }) => void;
  cancelSpreadDealSchedule: () => void;
  playRevealCinematic: () => void;
};

const ReadingAudioContext = createContext<ReadingAudioContextValue | null>(null);

export function useReadingAudio(): ReadingAudioContextValue | null {
  return useContext(ReadingAudioContext);
}

export function ReadingAudioProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);
  const engineRef = useRef<ReadingAudioEngine | null>(null);
  const getEngine = useCallback(() => {
    if (!engineRef.current) engineRef.current = new ReadingAudioEngine();
    return engineRef.current;
  }, []);

  const [ready, setReady] = useState(false);
  const [portalEntered, setPortalEntered] = useState(false);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );

  const soundAllowed = !reducedMotion;
  const soundAllowedRef = useRef(soundAllowed);
  soundAllowedRef.current = soundAllowed;
  const portalEnteredRef = useRef(portalEntered);
  portalEnteredRef.current = portalEntered;

  const syncAmbientLoop = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    if (!soundAllowed || !portalEntered) {
      e.stopAmbientLoop();
      return;
    }
    if (ready) {
      e.startAmbientLoop();
    }
  }, [soundAllowed, portalEntered, ready]);

  useMountEffect(() => {
    const e = getEngine();
    e.setOutputEnabled(true);
    void e.preload().then(() => {
      setReady(e.isPreloaded);
      if (e.isPreloaded && soundAllowedRef.current && portalEnteredRef.current) {
        e.startAmbientLoop();
      }
    });
    return () => {
      e.dispose();
      engineRef.current = null;
    };
  });

  useReactiveEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    const wasRitual = prev === "/reading" || prev === "/portal";
    const stillRitual = pathname === "/reading" || pathname === "/portal";
    if (wasRitual && !stillRitual) {
      setPortalEntered(false);
      engineRef.current?.stopAmbientLoop();
    }
  }, [pathname]);

  useReactiveEffect(() => {
    syncAmbientLoop();
  }, [syncAmbientLoop]);

  const beginAmbientFromReadingNav = useCallback(async () => {
    const e = getEngine();
    e.beginResumeFromUserGesture();
    await e.preload();
    await e.resume();
    setPortalEntered(true);
    if (!soundAllowedRef.current) return;
    e.startAmbientLoop();
  }, [getEngine]);

  const notifyEnterPortal = useCallback(async () => {
    const e = getEngine();
    e.beginResumeFromUserGesture();
    await e.preload();
    await e.resume();
    setPortalEntered(true);
    if (!soundAllowedRef.current) return;
    e.playEnterPortal();
    e.startAmbientLoop();
  }, [getEngine]);

  const startWalletShuffleLoop = useCallback(() => {
    if (!soundAllowed) return;
    getEngine().startWalletShuffleLoop();
  }, [getEngine, soundAllowed]);

  const stopWalletShuffleLoop = useCallback(() => {
    getEngine().stopWalletShuffleLoop();
  }, [getEngine]);

  const primeAudioForSpread = useCallback(() => {
    getEngine().beginResumeFromUserGesture();
    void getEngine().resume();
  }, [getEngine]);

  const scheduleSpreadDealShuffleBed = useCallback(
    (opts: { staggerSec: number; durationSec: number; playbackRates: number[] }) => {
      getEngine().scheduleSpreadDealShuffleBed(opts);
    },
    [getEngine],
  );

  const cancelSpreadDealSchedule = useCallback(() => {
    getEngine().cancelSpreadDealSchedule();
  }, [getEngine]);

  const playRevealCinematic = useCallback(() => {
    getEngine().playRevealCinematic();
  }, [getEngine]);

  const value = useMemo(
    () => ({
      ready,
      beginAmbientFromReadingNav,
      notifyEnterPortal,
      startWalletShuffleLoop,
      stopWalletShuffleLoop,
      primeAudioForSpread,
      scheduleSpreadDealShuffleBed,
      cancelSpreadDealSchedule,
      playRevealCinematic,
    }),
    [
      ready,
      beginAmbientFromReadingNav,
      notifyEnterPortal,
      startWalletShuffleLoop,
      stopWalletShuffleLoop,
      primeAudioForSpread,
      scheduleSpreadDealShuffleBed,
      cancelSpreadDealSchedule,
      playRevealCinematic,
    ],
  );

  return (
    <ReadingAudioContext.Provider value={value}>
      {children}
    </ReadingAudioContext.Provider>
  );
}

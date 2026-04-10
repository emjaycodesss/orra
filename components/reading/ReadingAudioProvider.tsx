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
import { ReadingAudioEngine } from "@/lib/reading/reading-audio";

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

type ReadingAudioContextValue = {
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
  primeGameAudio: () => void;
  preloadGameAudio: () => Promise<void>;
  startGameLoop: () => void;
  stopGameLoop: () => void;
  playGameCorrect: () => void;
  playGameWrong: () => void;
  playGameStinger: () => void;
  playGameDamage: () => void;
};

const ReadingAudioContext = createContext<ReadingAudioContextValue | null>(null);

export function useReadingAudio(): ReadingAudioContextValue | null {
  return useContext(ReadingAudioContext);
}

/**
 * Shared ritual + duel audio. Ambient loop runs through portal→lobby until `startGameLoop` sets `gameRunAudioActiveRef` and stops it.
 */
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
  const gameRunAudioActiveRef = useRef(false);

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
    if (!soundAllowed || !portalEntered || gameRunAudioActiveRef.current) {
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
    const wasRitual =
      prev === "/reading" || prev === "/portal" || prev === "/game";
    const stillRitual =
      pathname === "/reading" || pathname === "/portal" || pathname === "/game";
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

  const primeGameAudio = useCallback(() => {
    getEngine().beginResumeFromUserGesture();
    void getEngine().resume();
  }, [getEngine]);

  const preloadGameAudio = useCallback(async () => {
    await getEngine().preloadGameAudio();
  }, [getEngine]);

  /** Duel BGM replaces ambient — stop the drone first so they never stack. */
  const startGameLoop = useCallback(() => {
    if (!soundAllowed) return;
    const e = getEngine();
    e.stopAmbientLoop();
    e.startGameLoop();
    gameRunAudioActiveRef.current = true;
  }, [getEngine, soundAllowed]);

  const stopGameLoop = useCallback(() => {
    gameRunAudioActiveRef.current = false;
    getEngine().stopGameLoop();
  }, [getEngine]);

  const playGameCorrect = useCallback(() => {
    if (!soundAllowed) return;
    getEngine().playGameCorrect();
  }, [getEngine, soundAllowed]);

  const playGameWrong = useCallback(() => {
    if (!soundAllowed) return;
    getEngine().playGameWrong();
  }, [getEngine, soundAllowed]);

  const playGameStinger = useCallback(() => {
    if (!soundAllowed) return;
    getEngine().playGameStinger();
  }, [getEngine, soundAllowed]);

  const playGameDamage = useCallback(() => {
    if (!soundAllowed) return;
    getEngine().playGameDamage();
  }, [getEngine, soundAllowed]);

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
      primeGameAudio,
      preloadGameAudio,
      startGameLoop,
      stopGameLoop,
      playGameCorrect,
      playGameWrong,
      playGameStinger,
      playGameDamage,
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
      primeGameAudio,
      preloadGameAudio,
      startGameLoop,
      stopGameLoop,
      playGameCorrect,
      playGameWrong,
      playGameStinger,
      playGameDamage,
    ],
  );

  return (
    <ReadingAudioContext.Provider value={value}>
      {children}
    </ReadingAudioContext.Provider>
  );
}

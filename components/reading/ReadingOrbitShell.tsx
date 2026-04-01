"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ReadingOrbitLayer } from "@/components/reading/ReadingOrbitLayer";
import { useReactiveLayoutEffect } from "@/hooks/useReactiveLayoutEffect";

export type ReadingOrbitBindings = {
  showEnterOverlay: boolean;
  softenForContent: boolean;
  onPortalEntered: () => void;
  onEnterClick?: () => void;
};

type RegisterFn = (b: ReadingOrbitBindings) => void;

const ReadingOrbitRegisterContext = createContext<RegisterFn | null>(null);

/**
 * Keeps `ReadingOrbitLayer` mounted for the whole `/reading` segment while `page.tsx` may lazy-load
 * the main client tree — avoids tearing down the canvas when chunks resolve.
 */
export function ReadingOrbitShellProvider({ children }: { children: ReactNode }) {
  const portalRef = useRef<() => void>(() => {});
  const enterClickRef = useRef<(() => void) | undefined>(undefined);

  const [flags, setFlags] = useState({
    showEnterOverlay: true,
    softenForContent: false,
  });

  const register = useCallback((b: ReadingOrbitBindings) => {
    portalRef.current = b.onPortalEntered;
    enterClickRef.current = b.onEnterClick;
    setFlags((prev) => {
      if (
        prev.showEnterOverlay === b.showEnterOverlay &&
        prev.softenForContent === b.softenForContent
      ) {
        return prev;
      }
      return {
        showEnterOverlay: b.showEnterOverlay,
        softenForContent: b.softenForContent,
      };
    });
  }, []);

  const stableOnPortalEntered = useCallback(() => {
    portalRef.current();
  }, []);

  const stableOnEnterClick = useCallback(() => {
    enterClickRef.current?.();
  }, []);

  const registerValue = useMemo(() => register, [register]);

  return (
    <ReadingOrbitRegisterContext.Provider value={registerValue}>
      {/*
        Orbit must be *inside* the same `.reading-page` stacking context as route content.
        If the opaque page wrapper is only a sibling after the orbit, it paints over ENTER.
      */}
      <div className="reading-page reading-page--orbit relative min-h-screen">
        <ReadingOrbitLayer
          showEnterOverlay={flags.showEnterOverlay}
          softenForContent={flags.softenForContent}
          onPortalEntered={stableOnPortalEntered}
          onEnterClick={stableOnEnterClick}
        />
        {children}
      </div>
    </ReadingOrbitRegisterContext.Provider>
  );
}

/** Called from `ReadingPageClient` so the shell tracks phase-driven orbit props and latest callbacks. */
export function useRegisterReadingOrbitBindings({
  showEnterOverlay,
  softenForContent,
  onPortalEntered,
  onEnterClick,
}: ReadingOrbitBindings): void {
  const register = useContext(ReadingOrbitRegisterContext);
  if (!register) {
    throw new Error(
      "useRegisterReadingOrbitBindings must be used inside ReadingOrbitShellProvider (see app/reading/layout.tsx).",
    );
  }

  useReactiveLayoutEffect(() => {
    register({
      showEnterOverlay,
      softenForContent,
      onPortalEntered,
      onEnterClick,
    });
  }, [register, showEnterOverlay, softenForContent, onPortalEntered, onEnterClick]);
}

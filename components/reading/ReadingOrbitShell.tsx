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
import { usePathname } from "next/navigation";
import { ReadingOrbitLayer } from "@/components/reading/ReadingOrbitLayer";
import { useReactiveLayoutEffect } from "@/hooks/useReactiveLayoutEffect";

/** True when the URL is the portal route (ENTER + path chooser live here). */
function isPortalPath(pathname: string | null) {
  if (pathname == null) return false;
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

export type ReadingOrbitBindings = {
  showEnterOverlay: boolean;
  softenForContent: boolean;
  onPortalEntered: () => void;
  onEnterClick?: () => void;
};

type RegisterFn = (b: ReadingOrbitBindings) => void;

const ReadingOrbitRegisterContext = createContext<RegisterFn | null>(null);

/**
 * Keeps `ReadingOrbitLayer` mounted for the `(experience)` route group (`/portal`, `/reading`, `/game`)
 * so the canvas survives client navigations. Default flags favor `/reading`/`/game` direct visits until
 * `/portal` registers intro state.
 */
export function ReadingOrbitShellProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const portalRef = useRef<() => void>(() => {});
  const enterClickRef = useRef<(() => void) | undefined>(undefined);

  const [flags, setFlags] = useState(() => ({
    showEnterOverlay: isPortalPath(pathname),
    softenForContent: !isPortalPath(pathname),
  }));

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

/** Called from `PortalPageClient` so the shell tracks phase-driven orbit props and latest callbacks. */
export function useRegisterReadingOrbitBindings({
  showEnterOverlay,
  softenForContent,
  onPortalEntered,
  onEnterClick,
}: ReadingOrbitBindings): void {
  const register = useContext(ReadingOrbitRegisterContext);
  if (!register) {
    throw new Error(
      "useRegisterReadingOrbitBindings must be used inside ReadingOrbitShellProvider (see app/(experience)/layout.tsx).",
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

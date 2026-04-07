"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { useRegisterReadingOrbitBindings } from "@/components/reading/ReadingOrbitShell";
import { ReadingPathChooser } from "@/components/reading/ReadingPathChooser";
import {
  OracleBackGlyph,
  ReadingOracleNavCta,
  ReadingConnectPrimary,
  ReadingWalletHeader,
} from "@/components/reading/ReadingWalletHud";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import { useReadingAudio } from "@/components/reading/ReadingAudioProvider";

type PortalPhase = "intro" | "connect" | "pathChoose";

export default function PortalPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const readingAudio = useReadingAudio();
  const { isConnected } = useAccount();
  const forcePathChooser = searchParams.get("view") === "paths";
  const [phase, setPhase] = useState<PortalPhase>(() => (forcePathChooser ? "connect" : "intro"));

  const onPortalEntered = useCallback(() => setPhase("connect"), []);
  const onEnterClick = useCallback(() => {
    void readingAudio?.notifyEnterPortal();
  }, [readingAudio]);

  useRegisterReadingOrbitBindings({
    showEnterOverlay: phase === "intro",
    softenForContent: phase !== "intro",
    onPortalEntered: onPortalEntered,
    onEnterClick: onEnterClick,
  });

  const showConnect = phase !== "intro" && !isConnected;
  const showPathChoose = phase !== "intro" && isConnected;

  return (
    <>
      {phase !== "intro" && (
        <header
          className="reading-fixed-util-header fixed left-4 right-4 top-0 z-[70] flex items-center justify-between gap-2 md:left-8 md:right-8"
          aria-label="Portal utilities"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <ReadingOracleNavCta
              label="Back to Dashboard"
              ariaLabel="Back to Dashboard"
              compact
              revealLabelOnHover
              className="reading-nav-oracle-cta--no-pulse"
              glyph={<OracleBackGlyph />}
              onClick={() => router.push("/")}
            />
          </div>
          <div className="shrink-0">
            <ReadingWalletHeader />
          </div>
        </header>
      )}
      <main
        className={`relative z-10 ${
          phase === "intro" || phase === "connect" || phase === "pathChoose"
            ? `reading-main--fill-viewport flex flex-col${phase === "intro" ? " pointer-events-none" : ""}`
            : ""
        } ${phase !== "intro" ? "reading-main-below-util-header" : ""}`}
      >
        {showConnect && (
          <div className="reading-approach-hero">
            <div className="reading-approach-logo-shell">
              <ReadingApproachLogoLoader />
            </div>
            <p
              className="reading-approach-lede flex max-w-xl flex-col items-center gap-1.5 text-center font-sans text-lg font-light leading-relaxed text-ink-800 sm:gap-2 sm:text-xl"
              style={{
                animation: "fadeUp 2.2s cubic-bezier(0.16,1,0.3,1) forwards",
                opacity: 0,
              }}
            >
              <span className="block">Something brought you here.</span>
              <span className="block">The oracle has been expecting you.</span>
            </p>
            <div className="flex flex-col items-center gap-3">
              <p className="reading-approach-sub max-w-sm font-sans text-center text-[13px] font-medium leading-relaxed text-ink-600">
                Connect your wallet to be seen.
              </p>
              <ReadingConnectPrimary />
            </div>
          </div>
        )}
        {showPathChoose && <ReadingPathChooser />}
      </main>
    </>
  );
}

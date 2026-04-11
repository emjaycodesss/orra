"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import { MdAutoAwesome, MdWhatshot } from "react-icons/md";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import { ReadingRitualOracleCta } from "@/components/reading/ReadingWalletHud";
import { useDecodedImagesReady } from "@/hooks/useDecodedImagesReady";
import { PORTAL_PATH_TILE_IMAGE_URLS } from "@/lib/game/experience-image-preload-urls";

/** Distinguishes modal copy by selected portal mode. */
type PathMode = "trivia" | "reading";

/**
 * Centralized card data keeps the two portal paths visually aligned.
 * Trivia uses `/game?entry=portal` so a stale `ended` cookie rotates back into lobby/draw.
 */
const PATH_CARDS: ReadonlyArray<{
  mode: PathMode;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  buttonLabel: string;
  buttonAria: string;
  onSelectPath: (router: ReturnType<typeof useRouter>) => void;
  howItWorksTitle: string;
  howItWorksLede: string;
  howItWorksSteps: string[];
}> = [
  {
    mode: "trivia",
    title: "Trivia Clash",
    description: "Draw on-chain arcana boosters, then enter a rapid trivia clash against oracle guardians.",
    imageSrc: "/trivia_clash.webp",
    imageAlt: "Arcane cards charged with lightning for Trivia Clash mode",
    buttonLabel: "Ascend\u2009to\u2009Clash",
    buttonAria: "Open Oracle Trivia Clash — Pyth quiz duel",
    onSelectPath: (router) => router.push("/game?entry=portal"),
    howItWorksTitle: "Trivia duel pipeline",
    howItWorksLede: "Fast, competitive mode with on-chain booster draws powering each run.",
    howItWorksSteps: [
      "Start a run and lock in your duel setup against an oracle-themed opponent.",
      "Draw booster effects and apply them to shift damage, shields, or scoring momentum.",
      "Answer timed questions across multiple rounds to build your final score.",
      "Submit the run to the leaderboard and compare performance against other players.",
    ],
  },
  {
    mode: "reading",
    title: "Oracle’s Revelation",
    description: "Reveal one verifiable card through entropy-backed oracle flow and receive your guided revelation.",
    imageSrc: "/revelation.webp",
    imageAlt: "Mystical energy and cosmic sight motif for Oracle’s Revelation mode",
    buttonLabel: "Claim\u2009Your\u2009Fate",
    buttonAria: "Continue to verifiable tarot draw at /reading",
    onSelectPath: (router) => router.push("/reading"),
    howItWorksTitle: "Verifiable draw pipeline",
    howItWorksLede:
      "One oracle snapshot hash + one entropy callback. Everything below can be independently verified on-chain.",
    howItWorksSteps: [
      "You answer realm, stance, timeframe, and truth. These become the structured reading context.",
      "On draw, Orra submits requestReading(feedId, oracleSnapshotHash); the hash commits the frozen Pyth fields.",
      "Pyth Entropy fulfills the request in a callback tx and returns a 32-byte random value.",
      "Card index is deterministic from that random value. Reversal uses bit 8: ((randomNumber >> 8) % 2) == 1 means reversed; otherwise upright.",
      "CardDrawn emits sequence, oracle hash, card index, and randomness for independent verification.",
    ],
  },
];

export function ReadingPathChooser() {
  const router = useRouter();
  const [activeHowItWorksMode, setActiveHowItWorksMode] = useState<PathMode | null>(null);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const activeCard = PATH_CARDS.find((card) => card.mode === activeHowItWorksMode) ?? PATH_CARDS[1];
  /** Aligns with raw `/public` URLs from `ExperienceImagePreload` + `unoptimized` tiles — no `/_next/image` mismatch. */
  const pathTileArtReady = useDecodedImagesReady(PORTAL_PATH_TILE_IMAGE_URLS);

  /** Keeps modal state updates in one place for clearer interaction flow. */
  const openHowItWorks = (mode: PathMode) => {
    setActiveHowItWorksMode(mode);
    setIsHowItWorksOpen(true);
  };

  return (
    <div className="reading-approach-hero reading-path-chooser">
      <div className="reading-approach-logo-shell">
        <ReadingApproachLogoLoader />
      </div>

      <p className="sr-only" aria-live="polite">
        {pathTileArtReady ? "Path choices ready." : "Loading path artwork."}
      </p>

      {!pathTileArtReady ? (
        <div
          className="flex min-h-[16rem] w-full max-w-md flex-col items-center justify-center gap-4 sm:min-h-[18rem]"
          aria-busy="true"
        >
          <div className="reading-uiverse-loader reading-uiverse-loader--portal-paths" aria-hidden>
            <div className="reading-uiverse-loader__ring reading-uiverse-loader__ring-1" />
            <div className="reading-uiverse-loader__ring reading-uiverse-loader__ring-2" />
            <div className="reading-uiverse-loader__ring reading-uiverse-loader__ring-3" />
          </div>
          <p className="text-center font-sans text-sm font-medium text-ink-500">Preparing paths…</p>
        </div>
      ) : (
        <>
      <div
        className="flex w-full max-w-xl flex-col items-center gap-2 text-center sm:max-w-2xl"
        style={{
          animation: "fadeUp 1.5s cubic-bezier(0.16,1,0.3,1) forwards",
          opacity: 0,
        }}
      >
        <h2 className="reading-approach-lede text-center text-lg font-light leading-snug text-ink-800 sm:text-xl">
          Which path are you going to choose?
        </h2>
      </div>

      <div
        className="grid w-full max-w-[22rem] grid-cols-1 gap-6 sm:max-w-[46rem] sm:grid-cols-2 sm:gap-5"
        style={{
          animation: "fadeUp 1.7s cubic-bezier(0.16,1,0.3,1) 0.12s forwards",
          opacity: 0,
        }}
      >
        {PATH_CARDS.map((card) => (
          <div
            key={card.mode}
            className="card-surface card-surface-static rounded-2xl px-3.5 py-3.5 shadow-[0_12px_40px_rgba(9,4,18,0.28)] sm:px-5 sm:py-5"
          >
            <div className="flex h-full min-h-[20.5rem] flex-col items-center gap-2 text-center sm:min-h-[22.5rem] sm:gap-2.5">
              <div className="relative h-[8.75rem] w-full overflow-hidden rounded-xl border border-white/45 bg-gradient-to-br from-white/35 via-white/18 to-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_10px_24px_rgba(9,4,18,0.18)] sm:h-[11rem]">
                <Image
                  src={card.imageSrc}
                  alt={card.imageAlt}
                  fill
                  sizes="(max-width: 640px) 88vw, 360px"
                  className="object-cover object-center"
                  priority
                  unoptimized
                />
              </div>

              <div className="flex flex-col items-center gap-1 pt-0.5 sm:pt-1">
                <h3 className="text-center text-[1.62rem] font-semibold leading-tight tracking-[0.005em] text-ink-900 sm:text-[20px]">
                  {card.title}
                </h3>
                <p
                  className="max-w-[30ch] overflow-hidden text-balance text-center text-[11px] leading-relaxed text-[#4f4268] sm:text-[12px]"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {card.description}
                </p>
              </div>

              <ReadingRitualOracleCta
                label={card.buttonLabel}
                ariaLabel={card.buttonAria}
                compact
                onClick={() => card.onSelectPath(router)}
                glyph={
                  card.mode === "trivia" ? (
                    <MdWhatshot className="oracle-button-svg text-[1rem]" aria-hidden />
                  ) : (
                    <MdAutoAwesome className="oracle-button-svg text-[1rem]" aria-hidden />
                  )
                }
                className="mt-auto w-full max-w-[12.25rem] sm:max-w-[13.5rem]"
              />
              <button
                type="button"
                onClick={() => openHowItWorks(card.mode)}
                className="text-[12px] font-medium text-ink-500 underline underline-offset-4 decoration-ink-300/70 transition-colors hover:text-ink-800 hover:decoration-ink-600"
                aria-haspopup="dialog"
                aria-expanded={isHowItWorksOpen && activeHowItWorksMode === card.mode}
                aria-controls="how-it-works-modal"
              >
                How it works
              </button>
            </div>
          </div>
        ))}
      </div>
        </>
      )}
      <div
        className={`fixed inset-0 z-[90] flex items-center justify-center px-4 backdrop-blur-[2px] transition-all duration-200 ease-out ${
          isHowItWorksOpen
            ? "bg-ink-900/45 opacity-100"
            : "pointer-events-none bg-ink-900/0 opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-it-works-title"
        aria-hidden={!isHowItWorksOpen}
        id="how-it-works-modal"
        onClick={() => setIsHowItWorksOpen(false)}
      >
        <div
          className={`card-surface w-full max-w-2xl px-7 py-6 transition-all duration-220 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-8 sm:py-7 ${
            isHowItWorksOpen
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-2 scale-[0.985] opacity-0"
          }`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <p
                id="how-it-works-title"
                className="text-[10px] font-semibold tracking-[0.16em] uppercase text-ink-400"
              >
                how it works
              </p>
              <p className="text-[16px] font-medium text-ink-900 leading-snug">
                {activeCard.howItWorksTitle}
              </p>
              <p className="text-[12px] text-ink-500 leading-relaxed">
                {activeCard.howItWorksLede}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsHowItWorksOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-gradient-to-b from-white/26 to-white/10 text-ink-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-8px_14px_rgba(255,255,255,0.05),0_10px_24px_rgba(9,4,18,0.32)] backdrop-blur-xl transition-all duration-300 hover:border-white/45 hover:from-white/34 hover:to-white/16 hover:text-ink-900 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-10px_16px_rgba(255,255,255,0.08),0_12px_28px_rgba(9,4,18,0.36)] focus-visible:border-white/45 focus-visible:from-white/34 focus-visible:to-white/16 focus-visible:text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-400/55"
              aria-label="Close how it works modal"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <ol className="mx-auto flex max-w-xl list-decimal flex-col gap-2 pl-5 text-[12px] text-ink-600 leading-relaxed">
            {activeCard.howItWorksSteps.map((step) => (
              <li key={step} className="text-left">
                {step}
              </li>
            ))}
          </ol>
          {activeCard.mode === "reading" && (
            <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
              Audit shortcut: verify request tx, callback tx, oracle snapshot hash, and raw feed inputs in the
              receipt. Matching values prove the draw path and reversal state.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

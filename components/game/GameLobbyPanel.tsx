"use client";

import Image from "next/image";
import { useRef, useState, useCallback } from "react";
import { Wand2 } from "lucide-react";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { MAJOR_ARCANA } from "@/lib/cards";
import { orraTriviaAddress } from "@/lib/orra-trivia";
import type { GameSession } from "@/lib/game/types";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import {
  ReadingOracleNavCta,
  ReadingRitualOracleCta,
  ReadingOracleIconChevron,
} from "@/components/reading/ReadingWalletHud";
import { BoosterCardsReveal } from "@/components/game/BoosterCardsReveal";
import { ShufflePhase } from "@/components/reading/ShufflePhase";

type BoosterDrawPhase = "idle" | "requesting" | "waiting" | "spreading" | "chosen";

type PublicSession = Omit<GameSession, "currentQuestionAnswer">;

/** Bare check icon — no circle container, per spec §2 */
function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      fill="currentColor"
    >
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
  );
}

/**
 * Pre-duel lobby: profile, booster draw, start clash. `onBoosterSpreadStart` hands off to the parent’s root-mounted spread
 * so `fixed` overlays are not clipped by lobby transforms. X avatars use `Image` `unoptimized` to avoid optimizer CDN timeouts.
 */
export function GameLobbyPanel({
  session,
  isConnected,
  triviaConfigured,
  receiptConfirmed,
  lastBoosters,
  boosterError,
  boosterPending,
  onRequestBoosters,
  onStartRun,
  profileUsername,
  onProfileUsername,
  onSaveProfile,
  profileBusy,
  profileMessage,
  feeDisplay,
  onLookupProfile,
  entropySequenceNumber,
  entropyRequestTxHash,
  entropyCallbackTxHash,
  onBoosterSpreadStart,
  startBusy,
  preparingRun,
}: {
  session: PublicSession;
  isConnected: boolean;
  triviaConfigured: boolean;
  receiptConfirmed: boolean;
  lastBoosters: [number, number, number] | null;
  boosterError: string | null;
  boosterPending: boolean;
  onRequestBoosters: () => void;
  onStartRun: () => void;
  profileUsername: string;
  onProfileUsername: (v: string) => void;
  onSaveProfile: () => void;
  profileBusy: boolean;
  profileMessage: string | null;
  feeDisplay: string;
  onLookupProfile: (username: string) => Promise<{
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    fallback: boolean;
  } | null>;
  entropySequenceNumber: bigint | null;
  entropyRequestTxHash: string | null;
  entropyCallbackTxHash: string | null;
  /** Called when the booster spread phase should begin. GamePageClient renders
   *  BoosterSpreadPhase at root level (outside any will-change container) and
   *  invokes `onDone` when the animation completes so the lobby can advance. */
  onBoosterSpreadStart: (onDone: () => void) => void;
  startBusy?: boolean;
  /** `/api/game/prepare-run` in flight — Start Clash stays disabled with explanatory copy below. */
  preparingRun?: boolean;
}) {
  const duelAddr = orraTriviaAddress();
  const hasLinkedX = Boolean(session.twitterHandle?.replace(/^@+/, "").trim());
  const canDrawBoosters = isConnected && triviaConfigured && !boosterPending && hasLinkedX;
  const preparingRunActive = Boolean(preparingRun);
  const canStart =
    isConnected &&
    lastBoosters !== null &&
    session.phase === "lobby" &&
    !boosterPending &&
    !startBusy &&
    hasLinkedX;
  const [phaseIndex, setPhaseIndex] = useState<0 | 1 | 2>(() => {
    if (lastBoosters) return 2;
    if (hasLinkedX) return 1;
    return 0;
  });
  const [boosterDrawPhase, setBoosterDrawPhase] = useState<BoosterDrawPhase>("idle");
  const boosterDrawInFlightRef = useRef(false);
  const [profilePreview, setProfilePreview] = useState<{
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    fallback: boolean;
  } | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [profileRequested, setProfileRequested] = useState(false);
  const autoAdvancedPhase = useRef(false);
  const profileEmpty = profileUsername.trim().length === 0;
  const isCheckingProfile = lookupBusy || profileBusy;
  const effectiveProfile = profilePreview;
  const profileHandle = (session.twitterHandle ?? effectiveProfile?.handle ?? profileUsername.trim())
    .replace(/^@+/, "")
    .trim();
  const profileDisplayName =
    effectiveProfile?.displayName ?? session.displayName ?? (profileHandle ? `@${profileHandle}` : "@");
  const profileAvatarUrl = effectiveProfile?.avatarUrl ?? session.avatarUrl ?? null;
  const canSaveProfile = !profileEmpty && isConnected;
  const canGoNext =
    phaseIndex === 0
      ? hasLinkedX && isConnected
      : phaseIndex === 1
        ? lastBoosters !== null
        : false;

  useReactiveEffect(() => {
    if (!hasLinkedX || autoAdvancedPhase.current) return;
    autoAdvancedPhase.current = true;
    if (phaseIndex === 0) setPhaseIndex(1);
  }, [hasLinkedX]);

  useReactiveEffect(() => {
    if (boosterDrawPhase === "idle") return;

    if (boosterDrawPhase === "requesting") {
      if (!boosterPending && entropyRequestTxHash) {
        boosterDrawInFlightRef.current = false;
        setBoosterDrawPhase("spreading");
      }
      return;
    }

    if (boosterDrawPhase === "spreading") {
      return;
    }
  }, [boosterDrawPhase, boosterPending, entropyRequestTxHash]);

  useReactiveEffect(() => {
    if (!boosterError) return;
    if (boosterDrawPhase === "spreading" || boosterDrawPhase === "chosen") return;
    boosterDrawInFlightRef.current = false;
    setBoosterDrawPhase("idle");
  }, [boosterError, boosterDrawPhase]);

  useReactiveEffect(() => {
    if (boosterDrawPhase !== "spreading") return;
    onBoosterSpreadStart(() => {
      window.scrollTo(0, 0);
      setPhaseIndex(2);
    });
  }, [boosterDrawPhase, onBoosterSpreadStart]);

  const resolveProfilePreview = async () => {
    const normalized = profileUsername.trim().replace(/^@+/, "");
    if (!normalized) return;
    setLookupBusy(true);
    try {
      const preview = await onLookupProfile(normalized);
      setProfilePreview((prev) => preview ?? prev ?? null);
    } finally {
      setLookupBusy(false);
    }
  };

  const handleSaveProfile = () => {
    setProfileRequested(true);
    void resolveProfilePreview().finally(() => onSaveProfile());
  };

  const handleRequestBoosters = useCallback(() => {
    if (boosterDrawInFlightRef.current) return;
    if (!canDrawBoosters) return;

    boosterDrawInFlightRef.current = true;
    setBoosterDrawPhase("requesting");
    onRequestBoosters();
  }, [canDrawBoosters, onRequestBoosters]);

  const navRow = (
    <div
      className={`qflow-nav-row w-full max-w-[392px] ${
        phaseIndex === 0 ? "justify-end" : "justify-center"
      }`}
    >
      {phaseIndex > 0 && phaseIndex < 2 && (
        <button
          type="button"
          onClick={() => setPhaseIndex((p) => (p > 0 ? ((p - 1) as 0 | 1 | 2) : p))}
          className="qflow-nav-btn text-ink-400 hover:text-ink-700 transition-colors duration-150"
        >
          ← Previous
        </button>
      )}
      {phaseIndex < 2 && (
        <ReadingRitualOracleCta
          label="Next"
          ariaLabel="Go to next setup phase"
          onClick={() => setPhaseIndex((p) => (p < 2 ? ((p + 1) as 0 | 1 | 2) : p))}
          disabled={!canGoNext}
          glyph={<ReadingOracleIconChevron />}
        />
      )}
    </div>
  );

  return (
    <div className="reading-phase-min-h flex w-full max-w-xl flex-col items-center justify-center gap-8 px-4 py-6 opacity-0 animate-fade-up sm:max-w-2xl">
      {!session && (
        <div className="fixed inset-0 flex items-center justify-center">
          <ReadingApproachLogoLoader />
        </div>
      )}

      {phaseIndex === 0 && (
        <div className="reading-approach-logo-shell opacity-0 animate-fade-up-1">
          <ReadingApproachLogoLoader />
        </div>
      )}

      {phaseIndex === 0 && (
        <h2 className="text-center text-[18px] font-light leading-relaxed text-ink-900">
          Seeker, by what sign shall the Oracle know you?
        </h2>
      )}

      {phaseIndex === 0 && (
        <div className="flex w-full max-w-[392px] flex-col items-stretch gap-6">
          <label
            htmlFor="game-x-handle"
            className="self-start text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400"
          >
            X handle
            <span className="ml-1 text-rose-300/90" aria-hidden>*</span>
            <span className="sr-only"> (required)</span>
          </label>
          <div className="cosmic-search w-full">
            <div
              className="cosmic-search__main relative w-full"
              data-loading={isCheckingProfile ? "true" : "false"}
            >
              <div className="cosmic-search__nebula pointer-events-none" aria-hidden />
              <div className="cosmic-search__starfield pointer-events-none" aria-hidden />
              <div className="cosmic-search__cosmic-ring pointer-events-none" aria-hidden />
              <div className="cosmic-search__stardust pointer-events-none" aria-hidden />
              <div className="cosmic-search__field-fill pointer-events-none" aria-hidden />
              <span
                className="cosmic-search__icon-left pointer-events-none"
                aria-hidden
                style={{
                  color: profileEmpty ? "var(--ink-400)" : "var(--accent-light)",
                  transition: "color 0.15s",
                  fontSize: "16px",
                  fontWeight: 600,
                }}
              >
                @
              </span>
              <div className="cosmic-search__wormhole-border pointer-events-none" aria-hidden />
              <button
                type="button"
                className={`cosmic-search__wormhole-face game-profile-check ${
                  !canSaveProfile || isCheckingProfile
                    ? "cursor-not-allowed"
                    : "transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_12px_rgba(167,139,250,0.35)]"
                }`}
                style={{
                  color: "var(--accent-light)",
                  opacity: (profileEmpty || isCheckingProfile) ? 0.3 : 1,
                  pointerEvents: "auto",
                  zIndex: 9,
                  transition: "opacity 0.15s",
                }}
                onClick={handleSaveProfile}
                disabled={!canSaveProfile || isCheckingProfile}
                aria-label={isCheckingProfile ? "Saving profile" : "Save profile"}
                aria-busy={isCheckingProfile}
                title={!isConnected ? "Connect your wallet first" : profileEmpty ? "Enter your X handle" : ""}
              >
                {isCheckingProfile ? (
                  <span className="game-profile-spinner" aria-hidden />
                ) : (
                  <CheckGlyph />
                )}
                <span className="sr-only">
                  {isCheckingProfile ? "Saving profile" : "Save profile"}
                </span>
              </button>
              <input
                id="game-x-handle"
                type="text"
                autoComplete="username"
                value={profileUsername}
                onChange={(e) => {
                  setProfileRequested(false);
                  onProfileUsername(e.target.value);
                }}
                required
                aria-required="true"
                data-empty={profileEmpty ? "true" : "false"}
                className="cosmic-search__input w-full text-[13px] font-medium focus:outline-none"
              />
            </div>
          </div>
          {profileMessage && profileMessage !== "Saved." && (
            <p className="text-center text-sm text-ink-500" role="status">
              {profileMessage}
            </p>
          )}

          {((profilePreview && (profilePreview.avatarUrl || profilePreview.displayName)) || hasLinkedX) && (
            <div className="w-full card-surface card-surface-static rounded-xl overflow-hidden p-0">
              <div className="px-4 py-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300">
                  Seeker profile
                </span>
              </div>
              <div className="px-4 py-2.5 flex items-center gap-3">
                {profileAvatarUrl ? (
                  <Image
                    src={profileAvatarUrl}
                    alt=""
                    width={48}
                    height={48}
                    quality={90}
                    sizes="48px"
                    unoptimized
                    className="h-12 w-12 rounded-full border border-[var(--surface-3)] object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="h-12 w-12 shrink-0 rounded-full border border-[var(--surface-3)] bg-[var(--surface-3)]"
                    aria-hidden
                  />
                )}
                <div className="min-w-0 text-left">
                  <p className="truncate text-[15px] font-semibold text-ink-900">
                    {profileDisplayName || (profileHandle ? `@${profileHandle}` : "@")} 
                  </p>
                  <p className="text-[12px] text-ink-500">
                    {profileHandle ? `@${profileHandle}` : "@"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isConnected && (
            <p className="text-center text-[12px] font-medium leading-relaxed text-ink-500">
              Connect your wallet before continuing.
            </p>
          )}

          {navRow}
        </div>
      )}

      {phaseIndex === 1 && (
        <>
          {boosterDrawPhase === "idle" ? (
            <div className="reading-phase-min-h flex w-full flex-col items-center justify-center gap-8 pb-6 opacity-0 animate-fade-up">
              <div className="opacity-0 animate-fade-up-1">
                <ReadingApproachLogoLoader />
              </div>
              <h2 className="text-[20px] font-light text-ink-900 text-center">
                {profileDisplayName ? `Greetings, ${profileDisplayName}!` : "Greetings."}
              </h2>
              <p className="-mt-4 max-w-md text-center text-[13px] font-medium leading-relaxed text-ink-900">
                Your digital vessel is anchored. Now, bind your fate to the Entropy stream to reveal the 3 cards
                that will guide you throughout the game.
              </p>
              <div className="card-surface px-8 py-5 text-center">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-ink-400 mb-2">
                  drawing fee
                </p>
                <p className="text-[28px] font-extralight text-ink-900 tabular">
                  {feeDisplay}
                </p>
                <p className="text-[10px] text-ink-400 mt-3 leading-relaxed max-w-xs mx-auto">
                  Drawing seals your boosters on-chain with an Entropy request tied to your session.
                </p>
              </div>
              <ReadingRitualOracleCta
                label="Unveil  My  Alpha"
                ariaLabel="Draw three verifiable boosters on-chain"
                onClick={handleRequestBoosters}
                disabled={!canDrawBoosters || feeDisplay === "--"}
                glyph={<Wand2 className="oracle-button-svg" aria-hidden />}
              />
              <button
                type="button"
                onClick={() => {
                  setPhaseIndex(0);
                  setBoosterDrawPhase("idle");
                }}
                aria-label="Return to seeker profile"
                className="text-[12px] font-medium text-ink-500 underline underline-offset-4 decoration-ink-300/60 hover:text-ink-700 hover:decoration-ink-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-400"
              >
                Return to seeker profile
              </button>
              {boosterError && (
                <p className="text-[11px] font-medium text-danger text-center max-w-sm leading-relaxed">
                  {boosterError}
                </p>
              )}
            </div>
          ) : boosterDrawPhase === "spreading" ? (
            null
          ) : (
            <div className="w-full max-w-lg mx-auto opacity-0 animate-fade-up">
              <ShufflePhase
                key={`shuffle-${boosterDrawPhase}`}
                isDrawComplete={false}
                contractStatus="requesting"
                onSettleComplete={() => {}}
              />
            </div>
          )}
        </>
      )}

      {phaseIndex === 2 && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          {lastBoosters ? (
            <BoosterCardsReveal
              boosters={lastBoosters}
              canStart={canStart}
              onStart={onStartRun}
              entropySequenceNumber={entropySequenceNumber}
              entropyRequestTxHash={entropyRequestTxHash}
              entropyCallbackTxHash={entropyCallbackTxHash}
              preparingRun={preparingRunActive}
              runStartPending={Boolean(startBusy && !preparingRunActive)}
            />
          ) : (
            <p className="text-center text-[12px] font-medium text-ink-500">
              No boosters drawn yet. Go back and draw first.
            </p>
          )}
          {navRow}
        </div>
      )}
    </div>
  );
}

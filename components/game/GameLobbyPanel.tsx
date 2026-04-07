"use client";

import Image from "next/image";
import { useState } from "react";
import { formatEther } from "viem";
import { majorArcanaName } from "@/lib/game/tarot-labels";
import { orraDuelAddress } from "@/lib/orra-duel";
import type { GameSession } from "@/lib/game/types";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import {
  OracleBackGlyph,
  OracleReadyGlyph,
  ReadingOracleNavCta,
} from "@/components/reading/ReadingWalletHud";

type PublicSession = Omit<GameSession, "currentQuestionAnswer">;

export function GameLobbyPanel({
  session,
  isConnected,
  duelConfigured,
  devMock,
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
  feeWei,
  onLookupProfile,
}: {
  session: PublicSession;
  isConnected: boolean;
  duelConfigured: boolean;
  devMock: boolean;
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
  feeWei: bigint | null;
  onLookupProfile: (username: string) => Promise<{
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    fallback: boolean;
  } | null>;
}) {
  const duelAddr = orraDuelAddress();
  /** Leaderboard + session require a persisted X profile from POST /api/game/profile. */
  const hasLinkedX = Boolean(session.twitterHandle?.replace(/^@+/, "").trim());
  const canDrawBoosters =
    isConnected && duelConfigured && !boosterPending && hasLinkedX;
  const canStart =
    isConnected &&
    lastBoosters !== null &&
    session.phase === "lobby" &&
    !boosterPending &&
    hasLinkedX;
  const [phaseIndex, setPhaseIndex] = useState<0 | 1 | 2>(() => {
    if (lastBoosters) return 2;
    if (hasLinkedX) return 1;
    return 0;
  });
  const [profilePreview, setProfilePreview] = useState<{
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    fallback: boolean;
  } | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lastLookedUp, setLastLookedUp] = useState("");
  const canGoNext =
    phaseIndex === 0 ? hasLinkedX : phaseIndex === 1 ? lastBoosters !== null : false;

  const describeBooster = (majorIndex: number) => {
    const label = majorArcanaName(majorIndex).toLowerCase();
    if (label.includes("fool")) return "Next answer counts as correct.";
    if (label.includes("strength")) return "Next wrong answer deals zero damage.";
    if (label.includes("world")) return "Next answer auto-corrects.";
    return "Off-meta major: slot is consumed and score takes a -30 penalty when used.";
  };

  const resolveProfilePreview = async () => {
    const normalized = profileUsername.trim().replace(/^@+/, "");
    if (!normalized || normalized === lastLookedUp) return;
    setLookupBusy(true);
    try {
      const preview = await onLookupProfile(normalized);
      setProfilePreview(preview);
      setLastLookedUp(normalized);
    } finally {
      setLookupBusy(false);
    }
  };

  return (
    <div className="reading-phase-min-h flex w-full max-w-xl flex-col items-center justify-center gap-8 px-4 pb-6 opacity-0 animate-fade-up sm:max-w-2xl">
      <div className="reading-approach-logo-shell opacity-0 animate-fade-up-1">
        <ReadingApproachLogoLoader />
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
        Phase {phaseIndex + 1} of 3
      </p>

      <h2 className="text-center text-[20px] font-light leading-relaxed text-ink-900">
        {phaseIndex === 0
          ? "Set up your profile"
          : phaseIndex === 1
            ? "Draw your boosters"
            : "Review your cards"}
      </h2>

      {phaseIndex === 1 && (
        <p className="max-w-sm text-center text-[12px] font-medium leading-relaxed text-ink-400">
          Draw three verifiable major-arcana boosters on-chain.
        </p>
      )}
      {phaseIndex === 2 && (
        <p className="max-w-sm text-center text-[12px] font-medium leading-relaxed text-ink-400">
          Check what each card does before starting your duel.
        </p>
      )}

      {phaseIndex === 0 && session.displayName && (
        <div className="card-surface flex w-full max-w-md items-center gap-3 rounded-2xl border border-[var(--surface-3)] bg-[var(--surface-2)]/80 p-4">
          {session.avatarUrl ? (
            <Image
              src={session.avatarUrl}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="h-11 w-11 shrink-0 rounded-full bg-[var(--surface-3)]" aria-hidden />
          )}
          <div className="min-w-0 text-left">
            <p className="truncate font-semibold text-ink-900">{session.displayName}</p>
            {session.twitterHandle && <p className="text-sm text-ink-500">{session.twitterHandle}</p>}
          </div>
        </div>
      )}

      {phaseIndex === 0 && (
        <div className="flex w-full max-w-md flex-col items-stretch gap-4">
          <label
            htmlFor="game-x-handle"
            className="text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400"
          >
            X handle<span className="ml-1 text-rose-300/90" aria-hidden>
              *
            </span>
            <span className="sr-only"> (required)</span>
          </label>
          <input
            id="game-x-handle"
            type="text"
            autoComplete="username"
            placeholder="username (no @)"
            value={profileUsername}
            onChange={(e) => onProfileUsername(e.target.value)}
            onBlur={() => void resolveProfilePreview()}
            required
            aria-required="true"
            className="min-h-11 w-full rounded-xl border border-[var(--surface-3)] bg-[var(--surface-1)] px-3 text-center font-sans text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-light)_45%,transparent)]"
          />
          <ReadingOracleNavCta
            label={profileBusy ? "Saving…" : "Save profile"}
            ariaLabel="Save X profile for leaderboard"
            onClick={onSaveProfile}
            disabled={profileBusy || !profileUsername.trim()}
            glyph={<OracleReadyGlyph />}
            className="reading-nav-oracle-cta--no-pulse min-h-11 w-full justify-center disabled:opacity-45"
          />
          {profileMessage && (
            <p className="text-center text-sm text-ink-500" role="status">
              {profileMessage}
            </p>
          )}
          {lookupBusy && (
            <p className="text-center text-sm text-ink-500" role="status">
              Fetching X profile…
            </p>
          )}
          {profilePreview && !hasLinkedX && (
            <div className="card-surface flex items-center gap-3 rounded-2xl border border-[var(--surface-3)] bg-[var(--surface-2)]/70 p-3.5">
              {profilePreview.avatarUrl ? (
                <Image
                  src={profilePreview.avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--surface-3)]" aria-hidden />
              )}
              <div className="min-w-0 text-left">
                <p className="truncate text-sm font-semibold text-ink-900">{profilePreview.displayName}</p>
                <p className="text-xs text-ink-500">{profilePreview.handle}</p>
              </div>
            </div>
          )}
          {!hasLinkedX && (
            <p className="text-center text-[12px] font-medium leading-relaxed text-ink-500">
              Save your profile before continuing.
            </p>
          )}
        </div>
      )}

      {phaseIndex === 1 && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          {devMock && (
            <span className="rounded-md border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-200">
              Dev mock
            </span>
          )}
          {!duelConfigured && (
            <p className="text-center text-[13px] leading-relaxed text-ink-500">
              Set{" "}
              <code className="rounded bg-[var(--surface-3)] px-1 font-mono text-[11px] text-ink-700">
                NEXT_PUBLIC_ORRA_DUEL_CONTRACT_ADDRESS
              </code>{" "}
              or enable{" "}
              <code className="rounded bg-[var(--surface-3)] px-1 font-mono text-[11px] text-ink-700">
                NEXT_PUBLIC_ORRA_DUEL_DEV_MOCK=1
              </code>{" "}
              in development.
            </p>
          )}
          {duelAddr && feeWei !== null && !devMock && (
            <p className="text-center text-[13px] font-medium tabular text-ink-600">Fee: {formatEther(feeWei)} ETH</p>
          )}
          {boosterError && (
            <p className="text-center text-sm text-red-400" role="alert">
              {boosterError}
            </p>
          )}
          <ReadingOracleNavCta
            label={boosterPending ? "Waiting for chain…" : "Draw boosters"}
            ariaLabel="Draw three verifiable boosters on-chain"
            onClick={onRequestBoosters}
            disabled={!canDrawBoosters}
            glyph={<OracleReadyGlyph />}
            className="reading-nav-oracle-cta--no-pulse min-h-11 w-full max-w-[min(100%,20rem)] justify-center disabled:opacity-45"
          />
          {lastBoosters && (
            <p className="text-center text-[12px] font-medium text-emerald-300">Boosters drawn. Continue to review.</p>
          )}
        </div>
      )}

      {phaseIndex === 2 && (
        <div className="flex w-full max-w-3xl flex-col items-center gap-6">
          {lastBoosters ? (
            <ul className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
              {lastBoosters.map((idx, i) => (
                <li
                  key={`${idx}-${i}`}
                  className="rounded-xl border border-[var(--surface-3)] bg-[var(--surface-1)] px-3 py-3 text-center sm:text-left"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Slot {i + 1}</span>
                  <p className="mt-1 font-sans text-sm font-medium text-ink-900">{majorArcanaName(idx)}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{describeBooster(idx)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-[12px] font-medium text-ink-500">No boosters drawn yet. Go back and draw first.</p>
          )}
          <ReadingOracleNavCta
            label="Start duel"
            ariaLabel="Start duel with drawn boosters"
            onClick={onStartRun}
            disabled={!canStart}
            glyph={<OracleReadyGlyph />}
            className="reading-nav-oracle-cta--no-pulse min-h-11 w-full max-w-[min(100%,20rem)] justify-center disabled:opacity-45"
          />
        </div>
      )}

      <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-3 pt-2">
        <ReadingOracleNavCta
          label="Previous"
          ariaLabel="Go to previous setup phase"
          onClick={() => setPhaseIndex((p) => (p > 0 ? ((p - 1) as 0 | 1 | 2) : p))}
          disabled={phaseIndex === 0}
          compact
          glyph={<OracleBackGlyph />}
          className="reading-nav-oracle-cta--no-pulse min-h-11 min-w-[9rem] justify-center disabled:opacity-45"
        />
        <ReadingOracleNavCta
          label="Next"
          ariaLabel="Go to next setup phase"
          onClick={() => setPhaseIndex((p) => (p < 2 ? ((p + 1) as 0 | 1 | 2) : p))}
          disabled={!canGoNext || phaseIndex === 2}
          compact
          glyph={<OracleReadyGlyph />}
          className="reading-nav-oracle-cta--no-pulse min-h-11 min-w-[9rem] justify-center disabled:opacity-45"
        />
      </div>
    </div>
  );
}

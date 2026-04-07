"use client";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import {
  OracleBackGlyph,
  OracleReadyGlyph,
  ReadingOracleNavCta,
  ReadingWalletHeader,
} from "@/components/reading/ReadingWalletHud";
import { GameLobbyPanel } from "@/components/game/GameLobbyPanel";
import { GameDuelPanel } from "@/components/game/GameDuelPanel";
import { SessionRecapModal } from "@/components/game/SessionRecapModal";
import { GameLeaderboardSnippet } from "@/components/game/GameLeaderboardSnippet";
import { useOrraDuelBoosters } from "@/hooks/useOrraDuelBoosters";
import type { GameSession } from "@/lib/game/types";
import { ORRA_DUEL_ABI, orraDuelAddress } from "@/lib/orra-duel";
import { useRegisterReadingOrbitBindings } from "@/components/reading/ReadingOrbitShell";

type PublicSession = Omit<GameSession, "currentQuestionAnswer">;

export default function GamePageClient() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [session, setSession] = useState<PublicSession | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const leaderboardSent = useRef(false);
  const recapAutoOpened = useRef(false);
  const {
    requestBoosters,
    isPending,
    lastBoosters,
    error,
    setLastBoosters,
    duelConfigured,
  } = useOrraDuelBoosters();
  const [feeWei, setFeeWei] = useState<bigint | null>(null);

  const devMock =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ORRA_DUEL_DEV_MOCK === "1";
  const duelAddr = orraDuelAddress();

  // Same orbit shell as `/portal` — continuous background when coming from the path chooser.
  const onOrbitPortalNoop = useCallback(() => {}, []);
  useRegisterReadingOrbitBindings({
    showEnterOverlay: false,
    softenForContent: true,
    onPortalEntered: onOrbitPortalNoop,
  });

  useReactiveEffect(() => {
    if (!duelAddr || !publicClient || devMock) {
      setFeeWei(null);
      return;
    }
    void publicClient
      .readContract({
        address: duelAddr,
        abi: ORRA_DUEL_ABI,
        functionName: "getFee",
      })
      .then((f) => setFeeWei(f as bigint))
      .catch(() => setFeeWei(null));
  }, [duelAddr, publicClient, devMock]);

  const refreshState = useCallback(async () => {
    let r = await fetch("/api/game/state", { credentials: "include" });
    if (r.status === 401) {
      await fetch("/api/game/session", { method: "POST", credentials: "include" });
      r = await fetch("/api/game/state", { credentials: "include" });
    }
    if (!r.ok) {
      setLoadErr("Could not load session");
      return;
    }
    const j = (await r.json()) as { session: PublicSession };
    setSession(j.session);
    setLoadErr(null);
  }, []);

  useReactiveEffect(() => {
    void refreshState();
  }, [refreshState]);

  useReactiveEffect(() => {
    if (session?.twitterHandle) {
      setProfileUsername(session.twitterHandle.replace(/^@+/, ""));
    }
  }, [session?.twitterHandle]);

  useReactiveEffect(() => {
    if (session?.phase !== "ended") {
      leaderboardSent.current = false;
      recapAutoOpened.current = false;
      return;
    }
    if (!recapAutoOpened.current) {
      recapAutoOpened.current = true;
      setRecapOpen(true);
    }
    const w = address ?? session.walletAddress;
    if (!w || leaderboardSent.current) return;
    leaderboardSent.current = true;
    void fetch("/api/game/leaderboard/submit", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: w, chainId }),
    });
  }, [session?.phase, session?.walletAddress, address, chainId]);

  const newSession = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/game/session", { method: "POST", credentials: "include" });
      setLastBoosters(null);
      await refreshState();
      setRecapOpen(false);
    } finally {
      setBusy(false);
    }
  }, [refreshState, setLastBoosters]);

  const startRun = useCallback(async () => {
    if (!lastBoosters || !address) return;
    setBusy(true);
    try {
      const r = await fetch("/api/game/start-run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          boosterIndices: [...lastBoosters],
        }),
      });
      const j = (await r.json()) as { error?: string; session?: PublicSession };
      if (!r.ok) {
        if (j.error === "twitter_required") {
          throw new Error("Save your X handle before starting a duel.");
        }
        throw new Error(j.error ?? "start failed");
      }
      setSession(j.session!);
      setLastBoosters(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Start failed");
    } finally {
      setBusy(false);
    }
  }, [lastBoosters, address, setLastBoosters]);

  const postAnswer = useCallback(async (body: { boolChoice?: boolean; choiceIndex?: number }) => {
    setBusy(true);
    try {
      const r = await fetch("/api/game/answer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { error?: string; session?: PublicSession };
      if (!r.ok) throw new Error(j.error ?? "answer failed");
      setSession(j.session!);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Answer failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const postPower = useCallback(async (slot: 0 | 1 | 2) => {
    setBusy(true);
    try {
      const r = await fetch("/api/game/powerup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot }),
      });
      const j = (await r.json()) as { error?: string; session?: PublicSession };
      if (!r.ok) throw new Error(j.error ?? "powerup failed");
      setSession(j.session!);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Power-up failed");
    } finally {
      setBusy(false);
    }
  }, []);

  const saveProfile = useCallback(async () => {
    setProfileBusy(true);
    setProfileMessage(null);
    try {
      const r = await fetch("/api/game/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: profileUsername.trim() }),
      });
      const j = (await r.json()) as { error?: string; session?: PublicSession };
      if (!r.ok) throw new Error(j.error ?? "profile failed");
      setSession(j.session!);
      setProfileMessage("Saved.");
    } catch (e) {
      setProfileMessage(e instanceof Error ? e.message : "Could not save");
    } finally {
      setProfileBusy(false);
    }
  }, [profileUsername]);

  const lookupProfile = useCallback(async (username: string) => {
    try {
      const r = await fetch("/api/twitter-profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      if (!r.ok) return null;
      const j = (await r.json()) as {
        handle?: string;
        displayName?: string;
        avatarUrl?: string | null;
        fallback?: boolean;
      };
      if (!j.handle || !j.displayName) return null;
      return {
        handle: j.handle,
        displayName: j.displayName,
        avatarUrl: j.avatarUrl ?? null,
        fallback: j.fallback === true,
      };
    } catch {
      return null;
    }
  }, []);

  return (
    <>
      <header
        className="reading-fixed-util-header fixed left-4 right-4 top-0 z-[70] flex items-center justify-between gap-2 md:left-8 md:right-8"
        aria-label="Oracle Trivia Clash utilities"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <ReadingOracleNavCta
            label="Back to Portal"
            ariaLabel="Back to Portal"
            compact
            revealLabelOnHover
            className="reading-nav-oracle-cta--no-pulse reading-nav-oracle-cta--portal-back"
            glyph={<OracleBackGlyph />}
            onClick={() => router.push("/portal?view=paths")}
          />
        </div>
        <div className="shrink-0">
          <ReadingWalletHeader />
        </div>
      </header>
      <main
        className={`relative z-10 min-h-dvh pb-12 reading-main-below-util-header${
          session?.phase === "lobby" ? " reading-main--fill-viewport flex flex-col" : ""
        }`}
      >
        <div
          className={`mx-auto w-full max-w-5xl space-y-8 px-4 sm:px-6${
            session?.phase === "lobby" ? " flex min-h-0 flex-1 flex-col" : ""
          }`}
        >
          {loadErr && (
            <p className="text-sm text-red-400" role="alert">
              {loadErr}
            </p>
          )}

          {!session ? (
            <p className="text-[13px] font-medium text-ink-500">Loading…</p>
          ) : session.phase === "lobby" ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                <GameLobbyPanel
                  session={session}
                  isConnected={isConnected}
                  duelConfigured={duelConfigured}
                  devMock={devMock}
                  lastBoosters={lastBoosters}
                  boosterError={error}
                  boosterPending={isPending}
                  onRequestBoosters={requestBoosters}
                  onStartRun={startRun}
                  profileUsername={profileUsername}
                  onProfileUsername={setProfileUsername}
                  onSaveProfile={saveProfile}
                  onLookupProfile={lookupProfile}
                  profileBusy={profileBusy}
                  profileMessage={profileMessage}
                  feeWei={feeWei}
                />
              </div>
              <div className="mx-auto w-full max-w-4xl pb-8">
                <GameLeaderboardSnippet />
              </div>
            </>
          ) : session.phase === "running" ? (
            <GameDuelPanel
              session={session}
              busy={busy}
              onAnswerTf={(v) => void postAnswer({ boolChoice: v })}
              onAnswerMcq={(idx) => void postAnswer({ choiceIndex: idx })}
              onPowerUp={(s) => void postPower(s)}
            />
          ) : (
            <div className="card-surface card-surface-static max-w-xl space-y-5 rounded-2xl border border-[var(--surface-3)] p-6 sm:p-7 shadow-[0_12px_40px_rgba(9,4,18,0.28)]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                  Run complete
                </p>
                <p className="mt-1 font-sans text-[15px] font-medium leading-snug text-ink-900">
                  Recap and leaderboard
                </p>
                <p className="reading-approach-sub mt-2 text-[13px] font-medium leading-relaxed text-ink-600">
                  Your score is on the recap. Leaderboard submission runs once per session when a wallet
                  is available.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ReadingOracleNavCta
                  label="View recap"
                  ariaLabel="Open session recap"
                  onClick={() => setRecapOpen(true)}
                  glyph={<OracleReadyGlyph />}
                  className="reading-nav-oracle-cta--no-pulse min-h-11 justify-center sm:min-w-[11rem]"
                />
                <ReadingOracleNavCta
                  label="New session"
                  ariaLabel="Start a new session"
                  onClick={() => void newSession()}
                  disabled={busy}
                  glyph={<OracleBackGlyph />}
                  className="reading-nav-oracle-cta--no-pulse min-h-11 justify-center sm:min-w-[11rem] disabled:opacity-45"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {session?.phase === "ended" && (
        <SessionRecapModal
          session={session}
          open={recapOpen}
          onClose={() => setRecapOpen(false)}
          walletAddress={address ?? session.walletAddress}
        />
      )}
    </>
  );
}

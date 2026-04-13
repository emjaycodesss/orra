"use client";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { useReadingAudio } from "@/components/reading/ReadingAudioProvider";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { formatEther } from "viem";
import {
  OracleBackGlyph,
  ReadingOracleNavCta,
  ReadingHistoryBackCta,
  ReadingWalletHeader,
} from "@/components/reading/ReadingWalletHud";
import { GameLobbyPanel } from "@/components/game/GameLobbyPanel";
import { BoosterSpreadPhase } from "@/components/game/BoosterSpreadPhase";
import { GameDuelPanel } from "@/components/game/GameDuelPanel";
import type {
  ComboPendingKo,
  ComboPublicSession,
} from "@/components/game/combo-pending-ko";
import { GameRecapPage } from "@/components/game/GameRecapPage";
import { GameLeaderboardSnippet } from "@/components/game/GameLeaderboardSnippet";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import { useOrraTriviaBoosters } from "@/hooks/useOrraTriviaBoosters";
import type { GameSession } from "@/lib/game/types";
import {
  mergePublicSessionForAnswerBossDefeatReveal,
  mergePublicSessionFromServer,
} from "@/lib/game/merge-public-session";
import { LIVE_ORACLE_UNAVAILABLE_MESSAGE } from "@/lib/game/oracle-client-messages";
import { OPPONENTS } from "@/lib/game/opponents";
import { didBossDefeatBetweenSnapshots } from "@/lib/game/duel-ui-transitions";
import { ORRA_TRIVIA_ABI, orraTriviaAddress } from "@/lib/orra-trivia";
import { useRegisterReadingOrbitBindings } from "@/components/reading/ReadingOrbitShell";

type PublicSession = Omit<GameSession, "currentQuestionAnswer">;

/** User-facing copy for terse or opaque API error strings stored in `loadErr`. */
function loadErrMessageForDisplay(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "answer failed") {
    return "Could not submit answer. Try again.";
  }
  return raw;
}

/**
 * `/game` client: lobby, duel, recap. Booster spread + orbit bindings live here so `fixed` / canvas stay viewport-anchored.
 *
 * State merge: while arena KO is buffered, keep the prior `running` snapshot for the same session id — ignore `ended`
 * polls so recap does not preempt GSAP. Entering recap clears duel/lobby `loadErr` (leaderboard submit may set it again).
 * After booster `requestTxHash`, POST prepare-run for a fast Start Clash transition.
 *
 * `postAnswer` avoids toggling global `busy` (KO sets overlay lock). Drop same-session responses with lower `revision`
 * than the latest snapshot. `postPower` routes direct-damage boss defeats through the same KO buffer as graded answers.
 *
 * `pagehide` effect only registers the listener (cleanup removes it — no exit on `running→ended`). `exitGameToPortal`
 * calls `/api/game/exit` so returning to `/game` does not resume a stale run.
 */
export default function GamePageClient() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [session, setSession] = useState<PublicSession | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparingRun, setPreparingRun] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [isBoosterSpreadActive, setIsBoosterSpreadActive] = useState(false);
  const boosterSpreadDoneRef = useRef<(() => void) | null>(null);
  const leaderboardSent = useRef(false);
  const leaderboardSubmitInFlight = useRef(false);
  const didAutoExitRef = useRef(false);
  const {
    requestBoosters,
    isPending,
    receiptConfirmed,
    lastBoosters,
    error,
    setLastBoosters,
    sequenceNumber,
    requestTxHash,
    callbackTxHash,
    triviaConfigured,
  } = useOrraTriviaBoosters();
  const [feeWei, setFeeWei] = useState<bigint | null>(null);
  const devMockEnabled = process.env.NEXT_PUBLIC_ORRA_TRIVIA_DEV_MOCK === "1";
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  /**
   * Bumps after `/api/game/leaderboard/submit` succeeds so `GameRecapPage` refetches the table.
   * Without this, the recap's initial GET often finishes before the async submit persists the row.
   */
  const [leaderboardRefreshNonce, setLeaderboardRefreshNonce] = useState(0);
  /** Combo API result held until arena KO completes — keeps duel mounted and defers recap until merge. */
  const [comboPendingKo, setComboPendingKo] = useState<ComboPendingKo | null>(null);
  /**
   * Synchronous mirror of `comboPendingKo` so `refreshState` can refuse stale merges in the same tick
   * as `setComboPendingKo` (before React commits) — otherwise GET /state can land `ended` and mount recap
   * before the arena KO timeline runs (Chop / final guardian).
   */
  const comboPendingKoRef = useRef<ComboPendingKo | null>(null);
  const devMockWallet = "0x000000000000000000000000000000000000dead";
  const preparedForTxRef = useRef<string | null>(null);
  const sessionRef = useRef<PublicSession | null>(null);
  sessionRef.current = session;

  const readingAudio = useReadingAudio();
  /** Duel SFX/BGM buffers must be decoded before Start Clash (skipped when reduced motion disables game audio). */
  const [gameAudioReady, setGameAudioReady] = useState(false);

  const duelAddr = orraTriviaAddress();

  /** Heavy hit when arena KO starts — before boss-intro stinger (session merges after KO). */
  const playComboKoImpact = useCallback(() => {
    readingAudio?.playGameDamage();
  }, [readingAudio]);

  const handleComboKoComplete = useCallback((nextSession: ComboPublicSession) => {
    comboPendingKoRef.current = null;
    setComboPendingKo(null);
    setSession((prev) => mergePublicSessionFromServer(prev, nextSession));
    setBusy(false);
  }, []);

  const onOrbitPortalNoop = useCallback(() => {}, []);
  useRegisterReadingOrbitBindings({
    showEnterOverlay: false,
    softenForContent: true,
    onPortalEntered: onOrbitPortalNoop,
  });

  useReactiveEffect(() => {
    if (!readingAudio || session?.phase !== "lobby") {
      return undefined;
    }
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setGameAudioReady(true);
      return undefined;
    }
    let cancelled = false;
    readingAudio.primeGameAudio();
    void readingAudio.preloadGameAudio().then(() => {
      if (!cancelled) setGameAudioReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [readingAudio, session?.phase]);

  useReactiveEffect(() => {
    if (!duelAddr || !publicClient) {
      setFeeWei(null);
      return;
    }
    void publicClient
      .readContract({
        address: duelAddr,
        abi: ORRA_TRIVIA_ABI,
        functionName: "getFee",
      })
      .then((f) => setFeeWei(f as bigint))
      .catch(() => setFeeWei(null));
  }, [duelAddr, publicClient]);

  const refreshState = useCallback(async () => {
    /** Path chooser links with `?entry=portal`; used to avoid showing recap for a leftover `ended` cookie. */
    const fromPortal =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("entry") === "portal";

    let r = await fetch("/api/game/state", { credentials: "include" });
    if (r.status === 401) {
      await fetch("/api/game/session", { method: "POST", credentials: "include" });
      r = await fetch("/api/game/state", { credentials: "include" });
    }
    if (!r.ok) {
      setLoadErr("Could not load session");
      return;
    }
    let j = (await r.json()) as { session: PublicSession };

    if (fromPortal && j.session.phase === "ended") {
      const createRes = await fetch("/api/game/session", { method: "POST", credentials: "include" });
      if (!createRes.ok) {
        setLoadErr("Could not start a new session");
        return;
      }
      r = await fetch("/api/game/state", { credentials: "include" });
      if (!r.ok) {
        setLoadErr("Could not load session");
        return;
      }
      j = (await r.json()) as { session: PublicSession };
    }

    if (address && !j.session.twitterHandle) {
      try {
        const profileRes = await fetch("/api/game/profile-restore", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: address }),
        });
        if (profileRes.ok) {
          const profileData = (await profileRes.json()) as { session?: PublicSession };
          if (profileData.session) {
            j = { session: profileData.session };
          }
        }
      } catch {}
    }

    /**
     * Cookie now references a different session file (e.g. POST /api/game/exit or another tab) while
     * this tab still holds buffered KO UI — drop it so merge cannot leave orphan overlay state.
     */
    if (
      comboPendingKoRef.current != null &&
      j.session.id !== sessionRef.current?.id
    ) {
      comboPendingKoRef.current = null;
      setComboPendingKo(null);
    }

    setSession((prev) => {
      if (
        comboPendingKoRef.current != null &&
        prev != null &&
        j.session.id === prev.id
      ) {
        return prev;
      }
      return mergePublicSessionFromServer(prev, j.session);
    });
    setLoadErr(null);

    if (fromPortal) {
      router.replace("/game");
    }
  }, [address, router]);

  useReactiveEffect(() => {
    void refreshState();
  }, [refreshState, address]);

  /**
   * BFCache: Back after "Back to Portal" can restore a frozen `/game` document with stale React duel
   * state while the cookie already matches a fresh lobby — initial mount effects do not re-run.
   */
  useReactiveEffect(() => {
    const onPageShow = (ev: PageTransitionEvent) => {
      if (!ev.persisted) return;
      void refreshState();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [refreshState]);

  useReactiveEffect(() => {
    if (session?.phase === "ended") {
      setLoadErr(null);
    }
  }, [session?.phase]);

  const showLoader = !session && !loadErr;

  useReactiveEffect(() => {
    if (session?.twitterHandle) {
      setProfileUsername(session.twitterHandle.replace(/^@+/, ""));
    }
  }, [session?.twitterHandle]);

  useReactiveEffect(() => {
    if (session?.phase !== "ended") {
      leaderboardSent.current = false;
      leaderboardSubmitInFlight.current = false;
      setLeaderboardRefreshNonce(0);
      return;
    }
    const w = address ?? session.walletAddress;
    if (!w || leaderboardSent.current || leaderboardSubmitInFlight.current) return;
    leaderboardSubmitInFlight.current = true;
    void (async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await fetch("/api/game/leaderboard/submit", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: w, chainId }),
          });
          if (res.ok) {
            leaderboardSent.current = true;
            leaderboardSubmitInFlight.current = false;
            setLeaderboardRefreshNonce((n) => n + 1);
            return;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
      leaderboardSubmitInFlight.current = false;
      setLoadErr("Could not submit leaderboard run. Refresh recap to retry.");
    })();
  }, [session?.phase, session?.walletAddress, address, chainId]);

  const newSession = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/game/session", { method: "POST", credentials: "include" });
      const j = (await r.json()) as { error?: string; session?: PublicSession };
      if (!r.ok || !j.session) {
        throw new Error(j.error ?? "Could not create session");
      }
      setSession(mergePublicSessionFromServer(null, j.session));
      setLastBoosters(null);
      setLeaderboardOpen(false);
      setLoadErr(null);
      /**
       * Fresh `createLobbySession` has no twitterHandle/wallet on the snapshot. The only code
       * that merges wallet-linked profile from DB is `refreshState` (via profile-restore).
       * Initial page load runs that effect; Play Again must re-run the same path or the lobby
       * incorrectly asks for X handle again.
       */
      await refreshState();
    } finally {
      setBusy(false);
    }
  }, [setLastBoosters, refreshState]);

  const startRunWithBoosters = useCallback(async (boosters: [number, number, number]) => {
    const wallet = address ?? (devMockEnabled ? devMockWallet : null);
    if (!wallet) return;
    setBusy(true);
    try {
      const r = await fetch("/api/game/start-run", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: wallet,
          boosterIndices: [...boosters],
        }),
      });
      const j = (await r.json()) as { error?: string; session?: PublicSession };
      if (!r.ok) {
        if (j.error === "twitter_required") {
          throw new Error("Save your X handle before starting a duel.");
        }
        throw new Error(j.error ?? "start failed");
      }
      setSession((prev) => mergePublicSessionFromServer(prev, j.session!));
      setLastBoosters(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Start failed");
    } finally {
      setBusy(false);
    }
  }, [address, devMockEnabled, setLastBoosters]);

  const startRun = useCallback(async () => {
    if (!lastBoosters) return;
    await startRunWithBoosters(lastBoosters);
  }, [lastBoosters, startRunWithBoosters]);

  useReactiveEffect(() => {
    const txHash = requestTxHash;
    if (!txHash) return;
    if (preparedForTxRef.current === txHash) return;
    preparedForTxRef.current = txHash;
    setPreparingRun(true);
    void (async () => {
      try {
        const res = await fetch("/api/game/prepare-run", {
          method: "POST",
          credentials: "include",
        });
        const body = (await res.json()) as { error?: string; message?: string };
        if (!res.ok) {
          const code = body.error ?? "prepare_run_failed";
          const friendly =
            body.message ??
            (code === "live_snapshot_unavailable"
              ? LIVE_ORACLE_UNAVAILABLE_MESSAGE
              : code);
          throw new Error(friendly);
        }
      } catch (error) {
        setLoadErr(error instanceof Error ? error.message : "Could not prepare run questions");
      } finally {
        setPreparingRun(false);
      }
    })();
  }, [requestTxHash]);

  /** True while `/api/game/answer` fetch is in flight — duel disables inputs without toggling global lobby/arena `busy`. */
  const [answerSubmitPending, setAnswerSubmitPending] = useState(false);
  /** Bumps on failed `/api/game/answer` so duel UI can drop optimistic selection (options stay disabled while localSelected* is set). */
  const [answerSubmitFailureSeq, setAnswerSubmitFailureSeq] = useState(0);

  /** Best-effort session rotation on tab close / full unmount — guarded so phase-only rerenders do not fire exit. */
  const sendExitBeacon = useCallback(() => {
    if (didAutoExitRef.current) return;
    didAutoExitRef.current = true;
    try {
      const url = "/api/game/exit";
      const payload = "{}";
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      } else {
        void fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } catch {}
  }, []);

  const postAnswer = useCallback(async (
    body: { questionId: string; submitId: string; boolChoice?: boolean; choiceIndex?: number },
  ) => {
    let keepBusyForKo = false;
    setAnswerSubmitPending(true);
    /** Set when we parsed JSON from the answer response so catch can detect `stale_question` without re-reading the body. */
    let answerErrorCode: string | undefined;
    try {
      const r = await fetch("/api/game/answer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        priority: "high",
      });
      const raw = await r.text();
      let j: { error?: string; session?: PublicSession };
      try {
        j = JSON.parse(raw) as { error?: string; session?: PublicSession };
        if (typeof j?.error === "string") answerErrorCode = j.error;
      } catch {
        throw new Error("answer failed");
      }
      if (!r.ok) throw new Error(j.error ?? "answer failed");
      const incoming = j.session!;
      const incomingRev = incoming.revision ?? 0;
      const latestSnapshot = sessionRef.current;
      const latestRev = latestSnapshot?.revision ?? -1;
      const sameSessionAsLatest =
        latestSnapshot != null && incoming.id === latestSnapshot.id;
      if (sameSessionAsLatest && incomingRev < latestRev) {
        setLoadErr(null);
        return;
      }

      setLoadErr(null);

      /**
       * Route all boss defeats through KO buffering so the arena overlay is shown
       * before parent state advances to the next guardian/recap.
       */
      const didDefeatBoss =
        latestSnapshot?.phase === "running" &&
        didBossDefeatBetweenSnapshots({
          previousBossIndex: latestSnapshot.bossIndex,
          previousBossesDefeated: latestSnapshot.bossesDefeated,
          currentBossIndex: incoming.bossIndex,
          currentBossesDefeated: incoming.bossesDefeated,
        });
      if (didDefeatBoss && latestSnapshot) {
        const defeated = OPPONENTS[latestSnapshot.bossIndex] ?? OPPONENTS[0]!;
        setBusy(true);
        const pending: ComboPendingKo = {
          displayName: defeated.displayName,
          nextSession: incoming,
          feedback: {
            bossHpDelta: incoming.lastBossHpDelta ?? 0,
            playerHpDelta: incoming.lastPlayerHpDelta ?? 0,
            scoreDelta: incoming.lastScoreDelta ?? 0,
          },
        };
        comboPendingKoRef.current = pending;
        setComboPendingKo(pending);
        keepBusyForKo = true;
        setSession((prev) =>
          mergePublicSessionFromServer(
            prev,
            mergePublicSessionForAnswerBossDefeatReveal(latestSnapshot, incoming),
          ),
        );
        return;
      }

      comboPendingKoRef.current = null;
      setComboPendingKo(null);
      setSession((prev) => mergePublicSessionFromServer(prev, incoming));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "";
      const isStaleQuestion =
        answerErrorCode === "stale_question" || errMsg === "stale_question";
      if (isStaleQuestion) {
        await refreshState();
      } else {
        setLoadErr(errMsg || "Answer failed");
      }
      setAnswerSubmitFailureSeq((n) => n + 1);
    } finally {
      setAnswerSubmitPending(false);
      if (!keepBusyForKo) setBusy(false);
    }
  }, [refreshState]);

  const postQuestionClock = useCallback(async (questionId: string) => {
    try {
      const r = await fetch("/api/game/question-clock", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      const j = (await r.json()) as { error?: string; session?: PublicSession };
      if (!r.ok || !j.session) return;
      const incoming = j.session;
      setSession((prev) => mergePublicSessionFromServer(prev, incoming));
    } catch {
    }
  }, []);

  const postCombo = useCallback(async (payload: { comboDamageHp: number }): Promise<void> => {
    const cur = sessionRef.current;
    if (!cur || cur.phase !== "running") return;
    setBusy(true);
    try {
      const r = await fetch("/api/game/combo", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboDamageHp: payload.comboDamageHp }),
      });
      const j = (await r.json()) as { error?: string; session?: PublicSession };
      if (!r.ok) throw new Error(j.error ?? "combo failed");
      const incoming = j.session!;
      const incomingRev = incoming.revision ?? 0;
      const latestSnapshot = sessionRef.current;
      const latestRev = latestSnapshot?.revision ?? -1;
      const sameSessionAsLatest =
        latestSnapshot != null && incoming.id === latestSnapshot.id;
      if (sameSessionAsLatest && incomingRev < latestRev) {
        setBusy(false);
        return;
      }
      /**
       * Treat the combo as lethal only when the server snapshot confirms duel progression.
       * This avoids showing KO overlay for non-lethal combo damage outcomes.
       */
      const didDefeatBoss =
        latestSnapshot?.phase === "running" &&
        didBossDefeatBetweenSnapshots({
          previousBossIndex: latestSnapshot.bossIndex,
          previousBossesDefeated: latestSnapshot.bossesDefeated,
          currentBossIndex: incoming.bossIndex,
          currentBossesDefeated: incoming.bossesDefeated,
        });
      if (didDefeatBoss) {
        const defeated = OPPONENTS[latestSnapshot.bossIndex] ?? OPPONENTS[0]!;
        const pending: ComboPendingKo = {
          displayName: defeated.displayName,
          nextSession: incoming,
          feedback: {
            bossHpDelta: incoming.lastBossHpDelta ?? 0,
            playerHpDelta: incoming.lastPlayerHpDelta ?? 0,
            scoreDelta: incoming.lastScoreDelta ?? 0,
          },
        };
        comboPendingKoRef.current = pending;
        setComboPendingKo(pending);
        return;
      }
      comboPendingKoRef.current = null;
      setComboPendingKo(null);
      setSession((prev) => mergePublicSessionFromServer(prev, incoming));
      setBusy(false);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Combo failed");
      setBusy(false);
    }
  }, []);

  const postPower = useCallback(async (slot: 0 | 1 | 2) => {
    let keepBusyForKo = false;
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
      const incoming = j.session!;
      const incomingRev = incoming.revision ?? 0;
      const latestSnapshot = sessionRef.current;
      const latestRev = latestSnapshot?.revision ?? -1;
      const sameSessionAsLatest =
        latestSnapshot != null && incoming.id === latestSnapshot.id;
      if (sameSessionAsLatest && incomingRev < latestRev) {
        return;
      }

      const didDefeatBoss =
        latestSnapshot?.phase === "running" &&
        didBossDefeatBetweenSnapshots({
          previousBossIndex: latestSnapshot.bossIndex,
          previousBossesDefeated: latestSnapshot.bossesDefeated,
          currentBossIndex: incoming.bossIndex,
          currentBossesDefeated: incoming.bossesDefeated,
        });
      if (didDefeatBoss) {
        const defeated = OPPONENTS[latestSnapshot.bossIndex] ?? OPPONENTS[0]!;
        const pending: ComboPendingKo = {
          displayName: defeated.displayName,
          nextSession: incoming,
          feedback: {
            bossHpDelta: incoming.lastBossHpDelta ?? 0,
            playerHpDelta: incoming.lastPlayerHpDelta ?? 0,
            scoreDelta: incoming.lastScoreDelta ?? 0,
          },
        };
        comboPendingKoRef.current = pending;
        setComboPendingKo(pending);
        keepBusyForKo = true;
        return;
      }

      comboPendingKoRef.current = null;
      setComboPendingKo(null);
      setSession((prev) => mergePublicSessionFromServer(prev, incoming));
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Power-up failed");
    } finally {
      if (!keepBusyForKo) setBusy(false);
    }
  }, []);

  const submitProfile = useCallback(
    async (username: string, showMessage: boolean) => {
      if (!address && showMessage) {
        setProfileMessage("Connect your wallet first");
        return;
      }
      setProfileBusy(true);
      if (showMessage) setProfileMessage(null);
      try {
        const r = await fetch("/api/game/profile", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim(),
            walletAddress: address,
          }),
        });
        const j = (await r.json()) as { error?: string; session?: PublicSession };
        if (!r.ok) throw new Error(j.error ?? "profile failed");
        setSession((prev) => mergePublicSessionFromServer(prev, j.session!));
        if (showMessage) setProfileMessage("Saved.");
      } catch (e) {
        if (showMessage) {
          setProfileMessage(e instanceof Error ? e.message : "Could not save");
        }
      } finally {
        setProfileBusy(false);
      }
    },
    [address],
  );

  const saveProfile = useCallback(async () => {
    await submitProfile(profileUsername, true);
  }, [profileUsername, submitProfile]);


  const feeDisplay = useMemo(() => {
    if (feeWei === null) return "--";
    const [whole, fraction = ""] = formatEther(feeWei).split(".");
    const trimmedFraction = fraction.slice(0, 6).replace(/0+$/, "");
    return `${trimmedFraction ? `${whole}.${trimmedFraction}` : whole} ETH`;
  }, [feeWei]);

  const handleBoosterSpreadStart = useCallback((onDone: () => void) => {
    boosterSpreadDoneRef.current = onDone;
    setIsBoosterSpreadActive(true);
  }, []);

  const handleBoosterSpreadComplete = useCallback(() => {
    setIsBoosterSpreadActive(false);
    boosterSpreadDoneRef.current?.();
    boosterSpreadDoneRef.current = null;
  }, []);

  const handleBoosterSpreadTimeout = useCallback(() => {
    setIsBoosterSpreadActive(false);
    boosterSpreadDoneRef.current = null;
    setLoadErr("Booster reveal timed out. Please try drawing again.");
  }, []);

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

  useReactiveEffect(() => {
    const shouldAutoExit =
      session?.phase === "running" || session?.phase === "ended";
    if (!shouldAutoExit) return;

    const onPageHide = () => {
      const ph = sessionRef.current?.phase;
      if (ph !== "running" && ph !== "ended") return;
      sendExitBeacon();
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [session?.phase, sendExitBeacon]);

  useReactiveEffect(() => {
    return () => {
      const ph = sessionRef.current?.phase;
      if (ph !== "running" && ph !== "ended") return;
      sendExitBeacon();
    };
  }, [sendExitBeacon]);

  const exitGameToPortal = useCallback(async () => {
    try {
      const res = await fetch("/api/game/exit", { method: "POST", credentials: "include" });
      if (!res.ok) {
        await fetch("/api/game/session", { method: "POST", credentials: "include" });
      }
      setLastBoosters(null);
    } catch {}
    router.push("/portal?view=paths");
  }, [router, setLastBoosters]);

  return (
    <>
      {isBoosterSpreadActive && (
        <div className="fixed inset-0 z-30 flex items-center justify-center">
          <BoosterSpreadPhase
            key="booster-spread"
            boosters={lastBoosters ?? [0, 0, 0]}
            hasBoostersArrived={!!lastBoosters}
            onComplete={handleBoosterSpreadComplete}
            onTimeout={handleBoosterSpreadTimeout}
          />
        </div>
      )}
      {session?.phase !== "running" && (
        <header
          className="reading-fixed-util-header fixed left-4 right-4 top-0 z-[70] flex items-center justify-between gap-2 md:left-8 md:right-8"
          aria-label="Oracle Trivia Clash utilities"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            {leaderboardOpen ? (
              <ReadingHistoryBackCta onClick={() => setLeaderboardOpen(false)} />
            ) : (
              <ReadingOracleNavCta
                label="Back to Portal"
                ariaLabel="Back to Portal"
                compact
                revealLabelOnHover
                className="reading-nav-oracle-cta--no-pulse reading-nav-oracle-cta--portal-back"
                glyph={<OracleBackGlyph />}
                onClick={() => void exitGameToPortal()}
              />
            )}
            {session?.phase !== "ended" && (
              <button
                type="button"
                onClick={() => setLeaderboardOpen((v) => !v)}
                className="group inline-flex items-center gap-1.5 px-0 py-1 text-[14px] font-medium text-ink-500 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:text-ink-900 hover:underline hover:underline-offset-4 hover:decoration-accent-light/70 focus-visible:-translate-y-0.5 focus-visible:text-ink-900 focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent-light/70 active:translate-y-0 active:text-ink-700"
                aria-pressed={leaderboardOpen}
                aria-label="Toggle leaderboard"
              >
                Leaderboard
              </button>
            )}
          </div>
          <div className="shrink-0">
            <ReadingWalletHeader />
          </div>
        </header>
      )}
      <main
        className={`relative z-10 min-h-dvh reading-main-below-util-header${
          session?.phase === "running" ? "" : " pb-12"
        }${session?.phase === "lobby" ? " reading-main--fill-viewport flex flex-col" : ""}${
          session?.phase === "running" ? " reading-main--arena" : ""
        }`}
      >
        <div
          className={`fixed inset-0 z-[40] flex items-center justify-center transition-opacity duration-500 ease-out${
            showLoader ? " opacity-100" : " pointer-events-none opacity-0"
          }`}
          aria-hidden={!showLoader}
        >
          <ReadingApproachLogoLoader />
          <span className="sr-only" aria-busy="true" aria-live="polite">
            Loading Oracle Trivia Clash
          </span>
        </div>
        <div
          className={`${
            session?.phase === "running"
              ? "arena-stage"
              : "mx-auto w-full max-w-5xl space-y-8 px-4 sm:px-6"
          } transition-opacity duration-500 ease-out${
            showLoader ? " opacity-0" : " opacity-100"
          }${session?.phase === "lobby" ? " flex min-h-0 flex-1 flex-col" : ""}`}
        >
          {loadErr && (
            <p className="text-sm text-red-400" role="alert">
              {loadErrMessageForDisplay(loadErr)}
            </p>
          )}

          {leaderboardOpen ? (
            <div className="reading-history-scroll-host game-leaderboard-scroll-host items-stretch gap-0 overflow-hidden">
              <div className="reading-history-inner min-w-0 overflow-hidden">
                <div className="mx-auto w-full max-w-4xl px-2 pb-8 pt-2 sm:px-4">
                  <GameLeaderboardSnippet />
                </div>
              </div>
            </div>
          ) : session?.phase === "lobby" ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
                <GameLobbyPanel
                  session={session}
                  isConnected={isConnected}
                  triviaConfigured={triviaConfigured}
                  receiptConfirmed={receiptConfirmed}
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
                  feeDisplay={feeDisplay}
                  entropySequenceNumber={sequenceNumber}
                  entropyRequestTxHash={requestTxHash}
                  entropyCallbackTxHash={callbackTxHash}
                  onBoosterSpreadStart={handleBoosterSpreadStart}
                  startBusy={busy || preparingRun}
                  preparingRun={preparingRun}
                  gameAudioReady={gameAudioReady}
                />
              </div>
            </>
          ) : session?.phase === "running" ? (
            <GameDuelPanel
              session={session}
              busy={busy}
              answerSubmitPending={answerSubmitPending}
              answerSubmitFailureSeq={answerSubmitFailureSeq}
              comboPendingKo={comboPendingKo}
              onComboKoComplete={handleComboKoComplete}
              onComboKoImpact={playComboKoImpact}
              onAnswerTf={(v, questionId) =>
                void postAnswer({
                  questionId,
                  submitId: crypto.randomUUID(),
                  boolChoice: v,
                })}
              onAnswerMcq={(idx, questionId) =>
                void postAnswer({
                  questionId,
                  submitId: crypto.randomUUID(),
                  choiceIndex: idx,
                })}
              onPowerUp={(s) => void postPower(s)}
              onCombo={postCombo}
              onDeferredQuestionClockStart={(qid) => void postQuestionClock(qid)}
            />
          ) : session?.phase === "ended" ? (
            <GameRecapPage
              session={session}
              walletAddress={address ?? session.walletAddress}
              leaderboardRefreshNonce={leaderboardRefreshNonce}
              onNewSession={() => void newSession()}
              onBackToPortal={() => void exitGameToPortal()}
            />
          ) : null}
        </div>
      </main>
    </>
  );
}

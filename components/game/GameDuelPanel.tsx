"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { useReactiveLayoutEffect } from "@/hooks/useReactiveLayoutEffect";
import { useMountEffect } from "@/hooks/useMountEffect";
import { Rocket, Lock, Zap } from "lucide-react";
import { MdFullscreen, MdFullscreenExit } from "react-icons/md";
import { ReadingOracleNavCta } from "@/components/reading/ReadingWalletHud";
import gsap from "gsap";
import { DuelComboMinigame } from "@/components/game/DuelComboMinigame";
import { DUEL_HEAT_MAX } from "@/lib/game/duel-heat";
import { OPPONENTS, pickGuardianKoBanner } from "@/lib/game/opponents";
import { shouldRevealArenaBossDefeatAfterAnswer } from "@/lib/game/duel-ui-transitions";
import { CARD_FLAVOR_LINES } from "@/lib/game/card-effects";
import type { GameSession, LastWheelOutcome } from "@/lib/game/types";
import { TauntBubble } from "@/components/game/TauntBubble";
import { DuelQuestionPanel } from "@/components/game/DuelQuestionPanel";
import { DuelPowerUpModal } from "@/components/game/DuelPowerUpModal";
import { DuelArenaBackground } from "@/components/game/DuelArenaBackground";
import { DuelHUD } from "@/components/game/DuelHUD";
import { BossIntroModal } from "@/components/game/BossIntroModal";
import { QuestionCountdown } from "@/components/game/QuestionCountdown";
import { RevealAdvanceTimer } from "@/components/game/RevealAdvanceTimer";
import { QUESTION_BUDGET_SEC } from "@/lib/game/question-timer";
import { useReadingAudio } from "@/components/reading/ReadingAudioProvider";
import type { ComboPendingKo, ComboPublicSession } from "@/components/game/combo-pending-ko";

type PublicSession = Omit<GameSession, "currentQuestionAnswer">;
type DuelPhase =
  | "boss-intro"
  | "question"
  | "revealing"
  | "advancing"
  /** Arena stays mounted after reveal so K.O. can play; session merge runs after GSAP completes. */
  | "ko-pending";

/** Sync HUD timer with server `shownAtMs` when present (avoids resetting to full budget on revision-only updates). */
function remainFromShownAtMs(shownAtMs: number | null | undefined): number {
  if (shownAtMs == null) return QUESTION_BUDGET_SEC;
  return Math.max(
    0,
    Math.floor(QUESTION_BUDGET_SEC - (Date.now() - shownAtMs) / 1000),
  );
}
/** Reveal hold after each graded answer — tunable (was 3000ms). */
const REVEAL_ADVANCE_MS = 2000;
const PLAYER_CORRECT_QUIPS = [
  "Frontrunning.",
  "Oracle verified.",
  "Signal clean, latency mean.",
  "That's the data, not the drama.",
  "Confirmed on-chain.",
  "Gas-efficient dunk.",
  "Read the feed. Simple.",
  "Precision hits different.",
  "Price doesn't lie.",
  "That's what 400ms feels like.",
];

const PLAYER_WRONG_QUIPS = [
  "Feed lag. Recalibrating.",
  "Bad signal. Retrying.",
  "That one slipped the oracle.",
  "Price action disagrees.",
  "Confidence interval: not great.",
  "Noise, not signal. Got it.",
  "Missed that spread.",
  "Rechecking my thesis.",
  "The oracle saw it coming. I didn't.",
  "Latency cost me that one.",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

interface Props {
  session: PublicSession;
  busy: boolean;
  /** True while the `/api/game/answer` request is in flight (not power-up/combo). */
  answerSubmitPending: boolean;
  /** Incremented by parent when `/api/game/answer` fails — clears optimistic option highlight so retries are not stuck disabled. */
  answerSubmitFailureSeq: number;
  onAnswerTf: (v: boolean | undefined, questionId: string) => void;
  onAnswerMcq: (idx: number, questionId: string) => void;
  onPowerUp: (slot: 0 | 1 | 2) => void;
  onCombo: (payload: { comboDamageHp: number }) => Promise<void>;
  /** Buffered combo response — arena KO runs before parent merges `nextSession`. */
  comboPendingKo: ComboPendingKo | null;
  onComboKoComplete: (nextSession: ComboPublicSession) => void;
  /** Impact SFX when arena KO starts (e.g. damage hit). */
  onComboKoImpact?: () => void;
  /** When the first question of a guardian is shown after boss-intro, start the server question clock. */
  onDeferredQuestionClockStart?: (questionId: string) => void;
}

/**
 * Duel surface: boss-intro → question → reveal → advancing → KO buffer. Remount key ignores per-answer `revision`;
 * latches `q` across brief server nulls; clears optimistic picks when `questionSyncKey` changes mid-question.
 *
 * Failed answer POST: clear locals + bump `answerSubmitFailureRenderEpoch` so `canAnswer` sees `submitLockRef` after busy clears.
 * Combo auto-opens at max heat only in `question`. Arena KO GSAP runs after reveal floaters (skip during boss-intro); flash/title timing
 * is deliberately long so the beat reads as combo impact, not a glitch. After buffered KO merges, skip reveal pass-through → boss-intro.
 *
 * Boss index changes defer intro if this tick appended an answer or we are mid-reveal/advancing. Defeat detection uses
 * `shouldRevealArenaBossDefeatAfterAnswer` (final guardian included); reveal freezes speaker + HUD on the defeated guardian.
 *
 * Floaters: Chop may surface shield delta when boss HP delta is 0; power-up damage plays SFX without the graded-reveal path.
 * Snapshots: copy `q` into `revealQuestionRef` on submit and timeout. `advancing` holds until a new `currentQuestion` id lands.
 * Busy clears unlock the same question for retries. `preAnswerShieldHpRef` seeds Tower/Chop/combo shield floaters.
 */
export function GameDuelPanel({
  session,
  busy,
  answerSubmitPending,
  answerSubmitFailureSeq,
  onAnswerTf,
  onAnswerMcq,
  onPowerUp,
  onCombo,
  comboPendingKo,
  onComboKoComplete,
  onComboKoImpact,
  onDeferredQuestionClockStart,
}: Props) {
  const q = session.currentQuestion;
  const questionId = q?.id ?? null;

  /**
   * Remount key from visible question fields (Magician/Hermit/Justice swaps, Priestess/Sun cosmetics).
   * Omits `session.revision` — per-answer rev bumps must not remount (blackout/jitter).
   */
  const questionSyncKey = useMemo(
    () =>
      JSON.stringify({
        id: q?.id ?? null,
        type: q?.type,
        stem: q?.stem,
        eliminatedIndex: q?.eliminatedIndex,
        sunCorrectIndex: q?.sunCorrectIndex,
        sunCorrectBool: q?.sunCorrectBool,
        hierophantHint: q?.hierophantHint,
        tfLean: q?.tfLean,
      }),
    [q],
  );

  /** Slang K.O. line: stable for this defeat (revision bumps when `nextSession` lands). */
  const comboKoBannerLine = useMemo(() => {
    if (!comboPendingKo) return "";
    return pickGuardianKoBanner(comboPendingKo.displayName);
  }, [comboPendingKo]);

  const [duelPhase, setDuelPhase] = useState<DuelPhase>("boss-intro");
  const [remain, setRemain] = useState(QUESTION_BUDGET_SEC);

  const prevBossIndexRef = useRef(session.bossIndex);
  const pendingBossIntroRef = useRef(false);
  const lastAnsweredQuestionIdRef = useRef<string | null>(null);
  const revealQuestionRef = useRef<GameSession["currentQuestion"]>(null);
  const revealBossIndexRef = useRef<number | null>(null);
  const latchedQuestionRef = useRef<typeof q>(q ?? null);
  const revealHudSnapshotRef = useRef<{
    playerHp: number;
    bossHp: number;
    chopShieldHp: number;
  } | null>(null);
  const preAnswerHudSnapshotRef = useRef<{
    bossIndex: number;
    playerHp: number;
    bossHp: number;
    chopShieldHp: number;
  } | null>(null);
  const latestHudStateRef = useRef({
    bossIndex: session.bossIndex,
    playerHp: session.playerHp,
    bossHp: session.oppHp,
    chopShieldHp: session.chopShieldHp,
  });
  const visualBossIndex =
    duelPhase === "revealing" &&
    pendingBossIntroRef.current &&
    revealBossIndexRef.current != null
      ? revealBossIndexRef.current
      : session.bossIndex;
  const boss = OPPONENTS[visualBossIndex] ?? OPPONENTS[0]!;
  /** Hold post-hit HUD through reveal and in-arena K.O. so HP does not pop back before merge. */
  const useRevealHudFreeze =
    (duelPhase === "revealing" || duelPhase === "ko-pending") &&
    revealHudSnapshotRef.current != null;
  const displayPlayerHp = useRevealHudFreeze
    ? revealHudSnapshotRef.current!.playerHp
    : session.playerHp;
  const displayBossHp = useRevealHudFreeze
    ? revealHudSnapshotRef.current!.bossHp
    : session.oppHp;
  const displayChopShieldHp = useRevealHudFreeze
    ? revealHudSnapshotRef.current!.chopShieldHp
    : session.chopShieldHp;

  const [localSelectedIndex, setLocalSelectedIndex] = useState<number | null>(null);
  const [localSelectedBool, setLocalSelectedBool] = useState<boolean | null>(null);

  const [playerBubble, setPlayerBubble] = useState<string | null>(null);
  const [playerBubbleVariant, setPlayerBubbleVariant] = useState<"answer" | "powerup">("answer");
  const [bossBubble, setBossBubble] = useState<string | null>(null);

  const [floaters, setFloaters] = useState<{
    id: number;
    score: number;
    playerHp: number;
    bossHp: number;
  } | null>(null);
  const floatTimer = useRef<number | null>(null);
  const preAnswerShieldHpRef = useRef<number | null>(null);

  const prevAnswerLogLen = useRef(session.answerLog.length);
  /** Seeds once so we only boss-shake when `lastPowerUpFeedbackAtMs` increases (combo / power-up), not on first paint. */
  const powerUpShakeMountedRef = useRef(false);
  const prevPowerUpFeedbackAtMsShakeRef = useRef<number | null>(null);
  const prevAnswerLogLenForPowerUpShakeRef = useRef(session.answerLog.length);

  const playerAvatarRef = useRef<HTMLImageElement | null>(null);
  const bossAvatarRef = useRef<HTMLImageElement | null>(null);
  const arenaKoLayerRef = useRef<HTMLDivElement | null>(null);
  const arenaKoFlashRef = useRef<HTMLDivElement | null>(null);
  const arenaKoTitleRef = useRef<HTMLParagraphElement | null>(null);
  const arenaKoSubRef = useRef<HTMLParagraphElement | null>(null);
  const comboKoSeqRef = useRef(0);

  const [powerUpOpen, setPowerUpOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  /** After auto-open once at max heat, user retries via header / heat bar until heat resets. */
  const comboAutoLatchRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const submitLockRef = useRef(false);
  /**
   * Bumped on each `answerSubmitFailureSeq` handling so we re-render after the busy effect clears
   * `submitLockRef`. Timer-expired submits often leave `localSelected*` null; `setLocalSelected*(null)`
   * then bails out, so without this epoch `canAnswer` can stay stale (refs do not trigger renders).
   */
  const [answerSubmitFailureRenderEpoch, setAnswerSubmitFailureRenderEpoch] = useState(0);
  /** Tracks KO buffer so we can jump straight to boss-intro after merge (avoids a stale reveal / “empty duel” frame). */
  const prevComboPendingRef = useRef<ComboPendingKo | null>(null);

  useReactiveEffect(() => {
    if (answerSubmitFailureSeq === 0 || duelPhase !== "question") return;
    setLocalSelectedIndex(null);
    setLocalSelectedBool(null);
    revealQuestionRef.current = null;
    preAnswerShieldHpRef.current = null;
    preAnswerHudSnapshotRef.current = null;
    setAnswerSubmitFailureRenderEpoch((n) => n + 1);
  }, [answerSubmitFailureSeq, duelPhase]);

  useReactiveEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const fn = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const audio = useReadingAudio();

  useReactiveEffect(() => {
    if (q) latchedQuestionRef.current = q;
  }, [q]);

  useReactiveEffect(() => {
    if (duelPhase !== "question") return;
    setLocalSelectedIndex(null);
    setLocalSelectedBool(null);
  }, [questionSyncKey, duelPhase]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const duelHeat = session.duelHeat ?? 0;
  const comboReady =
    session.phase === "running" &&
    duelHeat >= DUEL_HEAT_MAX &&
    session.playerHp > 0 &&
    session.oppHp > 0;

  useReactiveEffect(() => {
    if (duelHeat < DUEL_HEAT_MAX) {
      comboAutoLatchRef.current = false;
    }
    if (!comboReady || busy || answerSubmitPending || powerUpOpen || comboOpen || comboPendingKo)
      return;
    if (duelPhase !== "question") return;
    if (comboAutoLatchRef.current) return;
    comboAutoLatchRef.current = true;
    setComboOpen(true);
  }, [
    duelHeat,
    comboReady,
    duelPhase,
    busy,
    answerSubmitPending,
    powerUpOpen,
    comboOpen,
    comboPendingKo,
  ]);

  useReactiveLayoutEffect(() => {
    if (!comboPendingKo) return;
    if (duelPhase === "revealing") return;
    if (duelPhase === "boss-intro") return;
    if (duelPhase !== "ko-pending" && duelPhase !== "question") return;
    const seq = ++comboKoSeqRef.current;
    const nextSession = comboPendingKo.nextSession;
    const root = arenaKoLayerRef.current;
    const flash = arenaKoFlashRef.current;
    const title = arenaKoTitleRef.current;
    const sub = arenaKoSubRef.current;
    const boss = bossAvatarRef.current;
    if (!root || !flash || !title || !sub) {
      onComboKoComplete(nextSession);
      return;
    }

    const finish = () => {
      if (seq !== comboKoSeqRef.current) return;
      onComboKoComplete(nextSession);
    };

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        onComboKoImpact?.();
        gsap
          .timeline({ onComplete: finish })
          .fromTo([title, sub], { opacity: 0 }, { opacity: 1, duration: 0.22 })
          .to(root, { opacity: 0, duration: 0.45, delay: 0.55 });
        return;
      }

      onComboKoImpact?.();
      gsap.set(flash, { opacity: 0 });
      gsap.set(title, { scale: 2.4, opacity: 0, y: 0 });
      gsap.set(sub, { opacity: 0, y: 8 });
      gsap.set(root, { opacity: 1 });

      const tl = gsap.timeline({ onComplete: finish });

      tl.fromTo(flash, { opacity: 0 }, { opacity: 0.82, duration: 0.12, ease: "power3.out" })
        .to(flash, { opacity: 0, duration: 0.28 })
        .to(
          title,
          { scale: 1, opacity: 1, duration: 0.52, ease: "back.out(1.55)" },
          "-=0.12",
        )
        .to(sub, { opacity: 1, y: 0, duration: 0.32, ease: "power2.out" }, "-=0.18");

      if (boss) {
        tl.to(
          boss,
          { x: 6, duration: 0.045, repeat: 8, yoyo: true, ease: "power1.inOut" },
          "-=0.14",
        )
          .to(
            boss,
            {
              filter: "brightness(0.32)",
              scale: 0.82,
              y: 44,
              opacity: 0,
              duration: 0.78,
              ease: "power3.in",
            },
            "+=0.42",
          )
          .to(
            [title, sub],
            { opacity: 0, y: -12, duration: 0.32, stagger: 0.06, ease: "power2.in" },
            "-=0.38",
          )
          .to(root, { opacity: 0, duration: 0.34, ease: "power2.in" }, "-=0.16");
      } else {
        tl.to([title, sub], { opacity: 0, duration: 0.34, stagger: 0.07 }, "+=0.65").to(
          root,
          { opacity: 0, duration: 0.3 },
          "-=0.12",
        );
      }
    }, root);

    return () => {
      ctx.revert();
    };
  }, [comboPendingKo, duelPhase, reducedMotion, onComboKoComplete, onComboKoImpact]);

  useReactiveLayoutEffect(() => {
    const hadPending = prevComboPendingRef.current != null;
    const nowPending = comboPendingKo != null;
    prevComboPendingRef.current = comboPendingKo;
    if (!hadPending || nowPending) return;
    if (session.phase !== "running") return;

    prevAnswerLogLen.current = session.answerLog.length;
    prevBossIndexRef.current = session.bossIndex;
    pendingBossIntroRef.current = false;
    revealBossIndexRef.current = null;
    revealHudSnapshotRef.current = null;
    setDuelPhase("boss-intro");
    setRemain(QUESTION_BUDGET_SEC);
    setBossBubble(null);
    setPlayerBubble(null);
    submitLockRef.current = false;
    audio?.playGameStinger();
  }, [comboPendingKo, session.answerLog.length, session.bossIndex, session.phase, audio]);

  const unusedCount = session.boosters.filter((b) => !b.used).length;
  const hasLockedBooster =
    session.bossIndex === 1 && session.boosters.some((b) => b.locked && !b.used);

  useMountEffect(() => {
    audio?.primeGameAudio();
    void audio?.preloadGameAudio();
    audio?.startGameLoop();
    return () => audio?.stopGameLoop();
  });

  useReactiveEffect(() => {
    if (session.bossIndex !== prevBossIndexRef.current) {
      const hasNewAnswerInThisTick =
        session.answerLog.length > prevAnswerLogLen.current;

      if (hasNewAnswerInThisTick) {
        pendingBossIntroRef.current = true;
        return;
      }

      if (duelPhase === "revealing" || duelPhase === "advancing") {
        pendingBossIntroRef.current = true;
        return;
      }

      pendingBossIntroRef.current = false;
      revealBossIndexRef.current = null;
      prevBossIndexRef.current = session.bossIndex;
      setDuelPhase("boss-intro");
      setRemain(QUESTION_BUDGET_SEC);
      setBossBubble(null);
      setPlayerBubble(null);
      audio?.playGameStinger();
    }
  }, [session.bossIndex, duelPhase, audio]);

  useReactiveEffect(() => {
    latestHudStateRef.current = {
      bossIndex: session.bossIndex,
      playerHp: session.playerHp,
      bossHp: session.oppHp,
      chopShieldHp: session.chopShieldHp,
    };
  }, [session.bossIndex, session.playerHp, session.oppHp, session.chopShieldHp]);

  useReactiveEffect(() => {
    const bossChangedFromPrev = session.bossIndex !== prevBossIndexRef.current;
    const newLen = session.answerLog.length;
    if (newLen <= prevAnswerLogLen.current) {
      prevAnswerLogLen.current = newLen;
      return;
    }
    prevAnswerLogLen.current = newLen;

    const lastEntry = session.answerLog[newLen - 1];
    if (!lastEntry) return;

    const isBossTransition = shouldRevealArenaBossDefeatAfterAnswer({
      bossChangedFromPrev,
      lastEntryBossIndex: lastEntry.bossIndex,
      sessionBossIndex: session.bossIndex,
      comboPendingKo,
    });
    if (isBossTransition) {
      pendingBossIntroRef.current = true;
      revealBossIndexRef.current = lastEntry.bossIndex;
      const preAnswerHud = preAnswerHudSnapshotRef.current;
      const prevHud =
        preAnswerHud && preAnswerHud.bossIndex === lastEntry.bossIndex
          ? preAnswerHud
          : latestHudStateRef.current;
      revealHudSnapshotRef.current = {
        playerHp: Math.max(
          0,
          prevHud.playerHp + (session.lastPlayerHpDelta ?? 0),
        ),
        bossHp: Math.max(
          0,
          prevHud.bossHp + (session.lastBossHpDelta ?? 0),
        ),
        chopShieldHp: prevHud.chopShieldHp,
      };
      preAnswerHudSnapshotRef.current = null;
    } else {
      revealBossIndexRef.current = null;
      revealHudSnapshotRef.current = null;
      preAnswerHudSnapshotRef.current = null;
    }
    lastAnsweredQuestionIdRef.current = lastEntry.questionId;
    setDuelPhase("revealing");

    if (lastEntry.correct) {
      setPlayerBubble(randomFrom(PLAYER_CORRECT_QUIPS));
      setPlayerBubbleVariant("answer");
      const tauntBoss = OPPONENTS[lastEntry.bossIndex] ?? boss;
      const isChop = lastEntry.bossIndex === 2;
      const chopShieldIsUp = session.chopShieldHp > 0;
      const chopCorrectPool =
        isChop && chopShieldIsUp
          ? tauntBoss.correctTauntsShieldUp
          : isChop && !chopShieldIsUp
            ? tauntBoss.correctTauntsShieldDown
            : null;
      setBossBubble(
        isBossTransition
          ? randomFrom(tauntBoss.defeatTaunts)
          : randomFrom(chopCorrectPool?.length ? chopCorrectPool : tauntBoss.correctTaunts),
      );
    } else {
      setPlayerBubble(randomFrom(PLAYER_WRONG_QUIPS));
      setPlayerBubbleVariant("answer");
      const tauntBoss = OPPONENTS[lastEntry.bossIndex] ?? boss;
      setBossBubble(randomFrom(tauntBoss.winTaunts));
    }

    if (lastEntry.correct) {
      audio?.playGameCorrect();
    } else {
      audio?.playGameWrong();
    }
    audio?.playGameDamage();

    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!reducedMotion) {
      if (lastEntry.correct && bossAvatarRef.current) {
        gsap.timeline()
          .to(bossAvatarRef.current, { x: -12, duration: 0.08, ease: "power2.out" }, 0)
          .to(bossAvatarRef.current, { x: 8, duration: 0.08 }, 0.08)
          .to(bossAvatarRef.current, { x: -6, duration: 0.08 }, 0.16)
          .to(bossAvatarRef.current, { x: 0, duration: 0.08 }, 0.24);
      } else if (!lastEntry.correct && playerAvatarRef.current) {
        gsap.timeline()
          .to(playerAvatarRef.current, { x: 12, duration: 0.08, ease: "power2.out" }, 0)
          .to(playerAvatarRef.current, { x: -8, duration: 0.08 }, 0.08)
          .to(playerAvatarRef.current, { x: 6, duration: 0.08 }, 0.16)
          .to(playerAvatarRef.current, { x: 0, duration: 0.08 }, 0.24);
      }
    }
  }, [session.answerLog, session.bossIndex, comboPendingKo, audio]);

  /**
   * Non-answer boss damage (combo / certain boosters): mirror correct-answer avatar shake.
   * SFX stays on the floater effect (`playGameDamage`) so we never double-fire audio.
   */
  useReactiveEffect(() => {
    const curMs = session.lastPowerUpFeedbackAtMs;
    const curLen = session.answerLog.length;
    if (!powerUpShakeMountedRef.current) {
      powerUpShakeMountedRef.current = true;
      prevPowerUpFeedbackAtMsShakeRef.current = curMs;
      prevAnswerLogLenForPowerUpShakeRef.current = curLen;
      return;
    }
    const prevMs = prevPowerUpFeedbackAtMsShakeRef.current;
    const prevLen = prevAnswerLogLenForPowerUpShakeRef.current;
    prevPowerUpFeedbackAtMsShakeRef.current = curMs;
    prevAnswerLogLenForPowerUpShakeRef.current = curLen;

    if (curMs == null) return;
    if (prevMs != null && curMs <= prevMs) return;
    if ((session.lastBossHpDelta ?? 0) >= 0) return;
    if (curLen > prevLen) return;
    if (reducedMotion) return;
    const el = bossAvatarRef.current;
    if (!el) return;
    gsap
      .timeline()
      .to(el, { x: -12, duration: 0.08, ease: "power2.out" }, 0)
      .to(el, { x: 8, duration: 0.08 }, 0.08)
      .to(el, { x: -6, duration: 0.08 }, 0.16)
      .to(el, { x: 0, duration: 0.08 }, 0.24);
  }, [
    session.lastPowerUpFeedbackAtMs,
    session.lastBossHpDelta,
    session.answerLog.length,
    reducedMotion,
  ]);

  useReactiveEffect(() => {
    if (session.lastAnswerAtMs == null && session.lastPowerUpFeedbackAtMs == null) return;
    if (floatTimer.current) {
      window.clearTimeout(floatTimer.current);
      floatTimer.current = null;
    }
    let bossFloaterDelta = session.lastBossHpDelta ?? 0;
    if (bossFloaterDelta === 0 && preAnswerShieldHpRef.current != null) {
      const shieldDelta = session.chopShieldHp - preAnswerShieldHpRef.current;
      if (shieldDelta < 0) bossFloaterDelta = shieldDelta;
    }
    const playerFloaterDelta = session.lastPlayerHpDelta ?? 0;
    if (
      session.lastPowerUpFeedbackAtMs != null &&
      (bossFloaterDelta < 0 || playerFloaterDelta < 0)
    ) {
      audio?.playGameDamage();
    }
    const floaterId =
      session.lastPowerUpFeedbackAtMs ?? session.lastAnswerAtMs ?? session.revision;
    setFloaters({
      id: floaterId,
      score: session.lastScoreDelta ?? 0,
      playerHp: playerFloaterDelta,
      bossHp: bossFloaterDelta,
    });
    preAnswerShieldHpRef.current = null;
    floatTimer.current = window.setTimeout(() => setFloaters(null), 3200);
    return () => {
      if (floatTimer.current) {
        window.clearTimeout(floatTimer.current);
        floatTimer.current = null;
      }
    };
  }, [
    session.lastAnswerAtMs,
    session.lastPowerUpFeedbackAtMs,
    session.revision,
    session.lastScoreDelta,
    session.lastPlayerHpDelta,
    session.lastBossHpDelta,
    session.chopShieldHp,
    audio,
  ]);

  const handleBossIntroComplete = () => {
    const qid = session.currentQuestion?.id ?? null;
    setDuelPhase("question");
    setRemain(remainFromShownAtMs(session.shownAtMs));
    setLocalSelectedIndex(null);
    setLocalSelectedBool(null);
    revealQuestionRef.current = null;
    if (qid && session.shownAtMs == null) {
      onDeferredQuestionClockStart?.(qid);
    }
  };

  const handleAnswerTf = (v: boolean) => {
    if (duelPhase !== "question" || !q?.id || submitLockRef.current) return;
    submitLockRef.current = true;
    revealQuestionRef.current = q ? { ...q } : null;
    preAnswerShieldHpRef.current = session.chopShieldHp;
    preAnswerHudSnapshotRef.current = {
      bossIndex: session.bossIndex,
      playerHp: session.playerHp,
      bossHp: session.oppHp,
      chopShieldHp: session.chopShieldHp,
    };
    setLocalSelectedBool(v);
    setLocalSelectedIndex(v ? 0 : 1);
    onAnswerTf(v, q.id);
  };

  const handleAnswerMcq = (idx: number) => {
    if (duelPhase !== "question" || !q?.id || submitLockRef.current) return;
    submitLockRef.current = true;
    revealQuestionRef.current = q ? { ...q } : null;
    preAnswerShieldHpRef.current = session.chopShieldHp;
    preAnswerHudSnapshotRef.current = {
      bossIndex: session.bossIndex,
      playerHp: session.playerHp,
      bossHp: session.oppHp,
      chopShieldHp: session.chopShieldHp,
    };
    setLocalSelectedIndex(idx);
    setLocalSelectedBool(null);
    onAnswerMcq(idx, q.id);
  };

  const handleTimerExpire = () => {
    if (duelPhase !== "question" || !q?.id || submitLockRef.current) return;
    submitLockRef.current = true;
    revealQuestionRef.current = q ? { ...q } : null;
    preAnswerShieldHpRef.current = session.chopShieldHp;
    preAnswerHudSnapshotRef.current = {
      bossIndex: session.bossIndex,
      playerHp: session.playerHp,
      bossHp: session.oppHp,
      chopShieldHp: session.chopShieldHp,
    };
    if (q.type === "tf") {
      onAnswerTf(undefined, q.id);
    } else {
      onAnswerMcq(-1, q.id);
    }
  };

  const handleRevealComplete = () => {
    setBossBubble(null);
    setPlayerBubble(null);
    setLocalSelectedIndex(null);
    setLocalSelectedBool(null);
    setRemain(QUESTION_BUDGET_SEC);
    revealQuestionRef.current = null;
    submitLockRef.current = false;
    if (pendingBossIntroRef.current) {
      pendingBossIntroRef.current = false;
      prevBossIndexRef.current = session.bossIndex;
      if (comboPendingKo) {
        setDuelPhase("ko-pending");
        return;
      }
      revealHudSnapshotRef.current = null;
      setDuelPhase("boss-intro");
      audio?.playGameStinger();
      return;
    }
    setDuelPhase("advancing");
  };

  useReactiveEffect(() => {
    if (duelPhase !== "advancing") return;

    if (session.bossIndex !== prevBossIndexRef.current) {
      pendingBossIntroRef.current = false;
      revealBossIndexRef.current = null;
      revealHudSnapshotRef.current = null;
      prevBossIndexRef.current = session.bossIndex;
      setDuelPhase("boss-intro");
      setRemain(QUESTION_BUDGET_SEC);
      audio?.playGameStinger();
      return;
    }

    const nextQuestionId = session.currentQuestion?.id ?? null;
    if (nextQuestionId && nextQuestionId !== lastAnsweredQuestionIdRef.current) {
      setDuelPhase("question");
      setRemain(remainFromShownAtMs(session.shownAtMs));
      submitLockRef.current = false;
      setLocalSelectedIndex(null);
      setLocalSelectedBool(null);
      revealQuestionRef.current = null;
    }
  }, [duelPhase, session.bossIndex, session.currentQuestion?.id, audio]);

  useReactiveEffect(() => {
    if (busy || answerSubmitPending) {
      submitLockRef.current = true;
      return;
    }
    if (duelPhase === "question") {
      submitLockRef.current = false;
    }
  }, [busy, answerSubmitPending, duelPhase]);

  const handlePowerUp = (slot: 0 | 1 | 2) => {
    preAnswerShieldHpRef.current = session.chopShieldHp;
    const booster = session.boosters[slot];
    if (booster) {
      const flavor = CARD_FLAVOR_LINES[booster.majorIndex];
      if (flavor) {
        setPlayerBubble(flavor);
        setPlayerBubbleVariant("powerup");
      }
    }
    onPowerUp(slot);
    setPowerUpOpen(false);
  };

  const effectTags = useMemo(() => {
    const tags: { label: string; tone: "attack" | "defend" | "wild"; icon: string }[] = [];
    /** Wheel (10) instant spin feedback — cleared on next graded answer; avoids duplicating forward-looking wheel tags. */
    const spin = session.lastWheelOutcome;
    const WHEEL_SPIN_LABEL: Record<LastWheelOutcome, string> = {
      wheel_heal10: "Wheel: +10 HP",
      wheel_hurt10: "Wheel: −10 HP",
      wheel_free_skip: "Wheel: free answer (0 pts)",
      wheel_double_next: "Wheel: 2× boss damage next correct",
    };
    if (spin) {
      tags.push({ label: WHEEL_SPIN_LABEL[spin], tone: "wild", icon: "RefreshCw" });
    }
    if (session.activeFoolNext && spin !== "wheel_free_skip") {
      tags.push({ label: "Fool: auto-correct", tone: "wild", icon: "Wand2" });
    }
    if (session.pendingWorldAuto) tags.push({ label: "World: half pts", tone: "wild", icon: "Wand2" });
    if (session.activeStrengthNext) tags.push({ label: "Strength: no dmg", tone: "defend", icon: "Shield" });
    if (session.activeEmperorNext) tags.push({ label: "Emperor: half dmg", tone: "defend", icon: "Shield" });
    if (session.activeTemperanceNext) tags.push({ label: "Temperance: split dmg", tone: "defend", icon: "Divide" });
    if (session.activeLoversNext) tags.push({ label: "Lovers: double or nothing", tone: "wild", icon: "Swords" });
    if (session.activeChariotNext) tags.push({ label: "Chariot: +10 dmg", tone: "attack", icon: "Swords" });
    if (session.activeMoonNext) tags.push({ label: "Moon: +20 dmg", tone: "attack", icon: "Swords" });
    if (session.activeHierophantNext) tags.push({ label: "Hierophant: +5 dmg", tone: "attack", icon: "BookOpen" });
    if (session.activeSunNext) tags.push({ label: "Sun: correct outlined", tone: "attack", icon: "Sun" });
    if (session.activeHighPriestessNext) tags.push({ label: "Priestess: hint", tone: "wild", icon: "EyeOff" });
    if (session.activeJusticeNext) tags.push({ label: "Justice: TF forced", tone: "wild", icon: "Scale" });
    if (session.activeHangedManPeek) tags.push({ label: "Hanged Man: +10s clock", tone: "wild", icon: "Eye" });
    if (session.activeWheelNext && spin !== "wheel_double_next") {
      tags.push({ label: "Wheel: double-or-nothing", tone: "wild", icon: "RefreshCw" });
    }
    if (session.activeWheelAutoNext && spin !== "wheel_free_skip") {
      tags.push({ label: "Wheel: free skip", tone: "wild", icon: "RefreshCw" });
    }
    if (session.activeDevilRoundsLeft > 0) {
      tags.push({ label: `Devil: ${session.activeDevilRoundsLeft} turns`, tone: "wild", icon: "Flame" });
    }
    return tags;
  }, [
    session.lastWheelOutcome,
    session.activeFoolNext, session.pendingWorldAuto, session.activeStrengthNext,
    session.activeEmperorNext, session.activeTemperanceNext, session.activeLoversNext,
    session.activeChariotNext, session.activeMoonNext, session.activeHierophantNext,
    session.activeSunNext, session.activeHighPriestessNext, session.activeJusticeNext,
    session.activeHangedManPeek, session.activeWheelNext, session.activeWheelAutoNext,
    session.activeDevilRoundsLeft,
  ]);

  const formatDelta = (value: number, suffix?: string) => {
    const sign = value > 0 ? "+" : "";
    return suffix ? `${sign}${value} ${suffix}` : `${sign}${value}`;
  };

  const playerName = session.displayName ?? session.twitterHandle ?? "Seeker";
  const activeFloaters = floaters;
  /** Stacking slot 0 = shared baseline across left/right; slot 1 = second row when both HP + PTS show on the player side. */
  const playerFloaterHp = Boolean(activeFloaters && activeFloaters.playerHp !== 0);
  const playerFloaterScore = Boolean(activeFloaters && activeFloaters.score !== 0);
  const playerScoreFloaterSlot = playerFloaterHp && playerFloaterScore ? 1 : 0;

  return (
    <>
      {duelPhase !== "boss-intro" && (
      <header className="duel-header-fixed" aria-label="Duel controls">
        <div className="duel-header-content">
          <div className="duel-header-left">
            <div className="duel-score-display">
              Score <span className="duel-score-value">{session.runScore}</span>
            </div>

            <ReadingOracleNavCta
              label={`Boosters (${unusedCount} left)`}
              ariaLabel={`Open boosters — ${unusedCount} unused`}
              onClick={() => setPowerUpOpen(true)}
              disabled={busy || answerSubmitPending || unusedCount === 0 || session.phase !== "running"}
              compact
              glyph={<Rocket className="oracle-button-svg" size={13} fill="currentColor" stroke="none" aria-hidden />}
              className="duel-header-oracle-btn"
            />
            {duelPhase === "question" && comboReady && (
              <ReadingOracleNavCta
                label="Combo"
                ariaLabel="Start combo sequence"
                onClick={() => setComboOpen(true)}
                disabled={busy || answerSubmitPending || comboOpen}
                compact
                glyph={<Zap className="oracle-button-svg" size={14} fill="currentColor" aria-hidden />}
                className="duel-header-oracle-btn duel-header-oracle-btn--combo"
              />
            )}
          </div>

          <ReadingOracleNavCta
            label=""
            ariaLabel={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={toggleFullscreen}
            compact
            glyph={isFullscreen
              ? <MdFullscreenExit className="oracle-button-svg" size={20} aria-hidden />
              : <MdFullscreen className="oracle-button-svg" size={20} aria-hidden />
            }
            className="duel-header-oracle-btn duel-header-oracle-btn--fullscreen"
          />
        </div>
      </header>
      )}

      {duelPhase !== "boss-intro" && (
        <div className="duel-area-container" data-boss-index={visualBossIndex}>
          <div className="duel-area-hud">
            <DuelHUD
              playerName={playerName}
              playerHp={displayPlayerHp}
              playerAvatarUrl={session.avatarUrl}
              bossIndex={visualBossIndex}
              bossHp={displayBossHp}
              chopShieldHp={displayChopShieldHp}
              duelHeat={duelHeat}
              questionsInDuel={session.questionsInDuel}
              remain={remain}
              onHeatBarActivate={
                duelPhase === "question" &&
                comboReady &&
                !busy &&
                !answerSubmitPending &&
                !comboOpen &&
                !comboPendingKo
                  ? () => setComboOpen(true)
                  : undefined
              }
            />
          </div>

          <div className="duel-arena-scene">
            <div className={`arena-scene ${boss.scene}`}>
              <div className="arena-stars" />
              <div className="arena-mist" />
              <div className="arena-trees arena-trees--far" />
              <div className="arena-trees arena-trees--mid" />
              <div className="arena-trees arena-trees--near" />
              <div className="arena-path" />
              <div className="arena-ground" />
            </div>

            <div className="arena-fighter arena-fighter--player">
              <TauntBubble text={playerBubble} side="player" variant={playerBubbleVariant} />
              {session.avatarUrl ? (
                <Image
                  ref={playerAvatarRef as React.Ref<HTMLImageElement>}
                  src={session.avatarUrl}
                  alt=""
                  width={120}
                  height={120}
                  className="arena-fighter-avatar"
                  unoptimized
                />
              ) : (
                <span className="arena-fighter-glyph">◈</span>
              )}
            </div>

            <div className="arena-fighter arena-fighter--enemy">
              <TauntBubble text={bossBubble} side="boss" />
              <Image
                ref={bossAvatarRef as React.Ref<HTMLImageElement>}
                src={boss.image}
                alt={boss.displayName}
                width={120}
                height={120}
                className="arena-fighter-avatar"
                unoptimized
              />
            </div>

            {activeFloaters && activeFloaters.playerHp !== 0 && (
              <span
                key={`hp-player-${activeFloaters.id}`}
                data-floater-slot={0}
                className={`arena-float arena-float--hp arena-float--player-floater ${
                  activeFloaters.playerHp > 0 ? "arena-float--heal" : "arena-float--dmg"
                }`}
                aria-hidden
              >
                {formatDelta(activeFloaters.playerHp, "HP")}
              </span>
            )}
            {activeFloaters && activeFloaters.score !== 0 && (
              <span
                key={`score-player-${activeFloaters.id}`}
                data-floater-slot={playerScoreFloaterSlot}
                className={`arena-float arena-float--score arena-float--player-floater ${
                  activeFloaters.score > 0 ? "arena-float--gain" : "arena-float--loss"
                }`}
                aria-hidden
              >
                {formatDelta(activeFloaters.score, "PTS")}
              </span>
            )}
            {activeFloaters && activeFloaters.bossHp !== 0 && (
              <span
                key={`hp-boss-${activeFloaters.id}`}
                data-floater-slot={0}
                className={`arena-float arena-float--hp arena-float--boss-floater ${
                  activeFloaters.bossHp > 0 ? "arena-float--heal" : "arena-float--dmg"
                }`}
                aria-hidden
              >
                {formatDelta(activeFloaters.bossHp, "HP")}
              </span>
            )}

            {comboPendingKo && (
              <div
                ref={arenaKoLayerRef}
                className="combo-ko-arena-layer"
                role="presentation"
                aria-hidden
              >
                <div ref={arenaKoFlashRef} className="combo-ko-arena-flash" />
                <p ref={arenaKoTitleRef} className="combo-ko-arena-title">
                  K.O.
                </p>
                <p ref={arenaKoSubRef} className="combo-ko-arena-sub">
                  {comboKoBannerLine}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="duel-question-area">
        {duelPhase !== "boss-intro" && duelPhase !== "ko-pending" && (
          <DuelQuestionPanel
            key={questionSyncKey}
            q={q}
            fallbackQuestion={latchedQuestionRef.current}
            lastQuestion={session.lastQuestion}
            lastAnswer={session.lastAnswer}
            effectTags={effectTags}
            busy={busy || answerSubmitPending}
            canAnswer={
              answerSubmitFailureRenderEpoch >= 0 &&
              duelPhase === "question" &&
              !submitLockRef.current &&
              !comboOpen &&
              !comboPendingKo
            }
            suddenDeath={session.suddenDeath}
            awaitingSuddenDeath={session.awaitingSuddenDeath}
            timerRemain={remain}
            isRevealing={duelPhase === "revealing"}
            revealQuestion={revealQuestionRef.current}
            localSelectedIndex={localSelectedIndex}
            localSelectedBool={localSelectedBool}
            onAnswerTf={handleAnswerTf}
            onAnswerMcq={handleAnswerMcq}
          />
        )}
      </div>

      {duelPhase === "question" && questionId != null && (
        <QuestionCountdown
          key={questionId}
          budgetSec={QUESTION_BUDGET_SEC}
          anchorMs={duelPhase === "question" ? session.shownAtMs ?? null : null}
          onTick={setRemain}
          onExpire={handleTimerExpire}
        />
      )}

      {duelPhase === "revealing" && (
        <RevealAdvanceTimer
          key={`reveal-${session.answerLog.length}`}
          delayMs={REVEAL_ADVANCE_MS}
          onComplete={handleRevealComplete}
        />
      )}

      {duelPhase === "boss-intro" && (
        <BossIntroModal
          key={session.bossIndex}
          bossIndex={session.bossIndex}
          onComplete={handleBossIntroComplete}
        />
      )}

      {powerUpOpen && (
        <DuelPowerUpModal
          boosters={session.boosters}
          bossIndex={session.bossIndex}
          judgementUsed={session.judgementUsed}
          busy={busy}
          onUse={handlePowerUp}
          onClose={() => setPowerUpOpen(false)}
        />
      )}

      {comboOpen && (
        <DuelComboMinigame
          reducedMotion={reducedMotion}
          onClose={() => setComboOpen(false)}
          onComplete={() => {
            void (async () => {
              try {
                preAnswerShieldHpRef.current = session.chopShieldHp;
                await onCombo({ comboDamageHp: 35 });
              } finally {
                setComboOpen(false);
              }
            })();
          }}
        />
      )}
    </>
  );
}

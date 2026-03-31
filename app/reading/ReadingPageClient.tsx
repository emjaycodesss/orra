"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useMemo, useRef } from "react";
import { useAccount } from "wagmi";
import { loadPastReadingsForAddress } from "@/lib/reading-history-store";
import { BrowserProvider, formatEther, type Eip1193Provider } from "ethers";

import { History, X } from "lucide-react";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import { useRegisterReadingOrbitBindings } from "@/components/reading/ReadingOrbitShell";
import {
  ReadingApproachReadyCta,
  ReadingConnectInline,
  ReadingConnectPrimary,
  ReadingHistoryBackCta,
  ReadingOracleIconCards,
  ReadingOracleIconChevron,
  ReadingRitualOracleCta,
  ReadingWalletHeader,
} from "@/components/reading/ReadingWalletHud";
import type { OracleAnswers } from "@/components/reading/QuestionFlow";
import { CardReveal } from "@/components/reading/CardReveal";
import { Interpretation } from "@/components/reading/Interpretation";

const QuestionFlow = dynamic(() =>
  import("@/components/reading/QuestionFlow").then((m) => m.QuestionFlow),
);
const ShufflePhase = dynamic(() =>
  import("@/components/reading/ShufflePhase").then((m) => m.ShufflePhase),
);
const SpreadPhase = dynamic(() =>
  import("@/components/reading/SpreadPhase").then((m) => m.SpreadPhase),
);
const ReadingReceipt = dynamic(() =>
  import("@/components/reading/ReadingReceipt").then((m) => m.ReadingReceipt),
);
const EntropyProof = dynamic(() =>
  import("@/components/reading/EntropyProof").then((m) => m.EntropyProof),
);
const MyReadings = dynamic(() =>
  import("@/components/reading/MyReadings").then((m) => m.MyReadings),
);
import { useReadingAudio } from "@/components/reading/ReadingAudioProvider";
import { useOrraContract } from "@/hooks/useOrraContract";
import { usePythStream } from "@/hooks/usePythStream";
import { useOracleState } from "@/hooks/useOracleState";
import {
  computeOracleState,
  type PythStreamData,
} from "@/lib/oracleState";
import { computeOracleSnapshotHash } from "@/lib/oracle-snapshot-hash";
import { MAJOR_ARCANA, type CardOrientation } from "@/lib/cards";
import { buildMessages } from "@/lib/prompt";
import { inferAssetClass } from "@/lib/asset-class";
import { fetchHistoricalContext } from "@/lib/historical-context";
import {
  formatPriceForOrraRecord,
  readOrraReadingRecord,
  saveOrraReadingRecord,
} from "@/lib/orra-reading-storage";
import { downloadReadingAsPng } from "@/lib/export-reading-png";
import { devWarn } from "@/lib/dev-warn";

type ReadingPhase =
  | "intro"
  | "approach"
  | "questions"
  | "connect"
  | "confirm"
  | "waiting"
  | "spread"
  | "revealed";

type ReadingSurfaceTab = "reading" | "history";

export default function ReadingPageClient() {
  const readingAudio = useReadingAudio();
  const [phase, setPhase] = useState<ReadingPhase>("intro");
  const [answers, setAnswers] = useState<OracleAnswers | null>(null);
  const [interpretation, setInterpretation] = useState("");
  const [waitingEpoch, setWaitingEpoch] = useState(0);
  const revealOnceRef = useRef(false);
  const [pythAtCommit, setPythAtCommit] = useState<PythStreamData | null>(null);
  const { isConnected, address } = useAccount();
  const [surfaceTab, setSurfaceTab] = useState<ReadingSurfaceTab>("reading");
  const [mobileHistoryView, setMobileHistoryView] = useState<'list' | 'detail'>('list');
  const [isDownloadingReading, setIsDownloadingReading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const contract = useOrraContract();

  const feedId = answers?.realmFeedId ?? 0;
  const rawPyth = usePythStream(feedId);
  const streamedOracle = useOracleState(rawPyth);
  const committedOracle = useMemo(
    () => (pythAtCommit ? computeOracleState(pythAtCommit) : null),
    [pythAtCommit]
  );
  const oracleForReading = committedOracle ?? streamedOracle;
  const selectedAssetClass = useMemo(
    () => inferAssetClass(answers?.realmSymbol ?? "BTC/USD"),
    [answers?.realmSymbol]
  );
  const readingBlockedReason = useMemo(() => {
    if (!answers) return null;
    if (!rawPyth) {
      return `Waiting for live ${answers.realm} price data before drawing.`;
    }
    if (rawPyth.priceFeedId !== answers.realmFeedId) {
      return `Waiting for the selected feed (${answers.realm}) to synchronize before drawing.`;
    }
    if (selectedAssetClass === "crypto") return null;
    if (streamedOracle.isStale) {
      return `${answers.realm} markets appear closed or inactive. Oracle data is stale. Return during active market hours for a reading.`;
    }
    return null;
  }, [answers, selectedAssetClass, rawPyth, streamedOracle.isStale]);
  const cardOrientation: CardOrientation =
    contract.isReversed === true ? "reversed" : "upright";

  const handleQuestionsComplete = useCallback(
    (a: OracleAnswers) => {
      setAnswers(a);
      if (isConnected) { setPhase("confirm"); contract.fetchFee(); }
      else { setPhase("connect"); }
    },
    [isConnected, contract]
  );

  const drawInFlightRef = useRef(false);

  const handleConfirm = useCallback(async () => {
    if (!answers || !rawPyth) return;
    if (readingBlockedReason) return;
    if (rawPyth.priceFeedId !== answers.realmFeedId) return;
    if (drawInFlightRef.current) return;
    drawInFlightRef.current = true;
    revealOnceRef.current = false;
    setPythAtCommit(rawPyth);
    const snapshotHash = computeOracleSnapshotHash(rawPyth);
    try {
      const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
      if (!eth) return;
      const provider = new BrowserProvider(eth);
      const signer = await provider.getSigner();
      setWaitingEpoch((n) => n + 1);
      setPhase("waiting");
      await contract.requestReading(signer, answers.realmFeedId, snapshotHash);
    } catch (e) {
      devWarn("reading-page:confirm-draw", e);
    } finally {
      drawInFlightRef.current = false;
    }
  }, [contract, answers, rawPyth, readingBlockedReason]);

  const handleReveal = useCallback(async () => {
    if (contract.cardIndex === null || !answers) return;
    if (revealOnceRef.current) return;
    revealOnceRef.current = true;
    setSurfaceTab("reading");
    setPhase("revealed");

    if (
      pythAtCommit &&
      contract.sequenceNumber !== null &&
      contract.feedId !== null &&
      contract.oracleSnapshotHash
    ) {
      try {
        const key = `reading-${contract.sequenceNumber.toString()}`;
        const payload = {
          sequenceNumber: contract.sequenceNumber.toString(),
          feedId: contract.feedId,
          oracleSnapshotHash: contract.oracleSnapshotHash,
          requestTxHash: contract.requestTxHash,
          callbackTxHash: contract.callbackTxHash,
          realm: answers.realm,
          realmSymbol: answers.realmSymbol,
          rawSnapshot: {
            feedId: contract.feedId,
            price: pythAtCommit.price,
            confidence: pythAtCommit.confidence,
            emaPrice: pythAtCommit.emaPrice,
            emaConfidence: pythAtCommit.emaConfidence,
            bestBidPrice: pythAtCommit.bestBidPrice,
            bestAskPrice: pythAtCommit.bestAskPrice,
            exponent: pythAtCommit.exponent,
            publisherCount: pythAtCommit.publisherCount,
            feedUpdateTimestamp: pythAtCommit.feedUpdateTimestamp,
          },
        };
        window.localStorage.setItem(key, JSON.stringify(payload));
      } catch (e) {
        devWarn("reading-page:persist-reading-local", e);
      }
    }

    const card = MAJOR_ARCANA[contract.cardIndex];
    if (!card) return;

    const historicalCtx = await fetchHistoricalContext(
      answers.realmSymbol,
      answers.timeframe
    );

    const promptBody = buildMessages({
      card,
      orientation: cardOrientation,
      asset: answers.realm,
      assetClass: inferAssetClass(answers.realmSymbol),
      oracle: oracleForReading,
      historicalContext: historicalCtx,
      questions: {
        realm: answers.realm,
        stance: answers.stance,
        timeframe: answers.timeframe,
        truth: answers.truth,
      },
    });

    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promptBody),
      });
      const data = (await res.json()) as {
        interpretation?: string;
        error?: string;
        details?: string;
      };
      if (res.ok) {
        const interp = data.interpretation ?? "";
        setInterpretation(interp);
        if (interp && contract.sequenceNumber !== null) {
          try {
            const storageKey = `reading-${contract.sequenceNumber.toString()}`;
            const existing = window.localStorage.getItem(storageKey);
            if (existing) {
              const parsed = JSON.parse(existing) as Record<string, unknown>;
              parsed.interpretation = interp;
              window.localStorage.setItem(storageKey, JSON.stringify(parsed));
            }
          } catch (e) {
            devWarn("reading-page:merge-interpretation", e);
          }
        }
      } else {
        const headline =
          (data.error ?? "").trim() || "The oracle falls silent. Try again.";
        const detail = (data.details ?? "").trim();
        setInterpretation(detail ? `${headline}\n\n${detail}` : headline);
      }
    } catch (e) {
      devWarn("reading-page:interpret-fetch", e);
      setInterpretation("The oracle falls silent. Try again.");
    }
  }, [
    contract.cardIndex,
    contract.sequenceNumber,
    contract.feedId,
    contract.oracleSnapshotHash,
    contract.requestTxHash,
    contract.callbackTxHash,
    answers,
    oracleForReading,
    cardOrientation,
    pythAtCommit,
  ]);

  const feeDisplay = useMemo(() => {
    if (!contract.fee) return "--";
    const [whole, fraction = ""] = formatEther(contract.fee).split(".");
    const trimmedFraction = fraction.slice(0, 6).replace(/0+$/, "");
    return `${trimmedFraction ? `${whole}.${trimmedFraction}` : whole} ETH`;
  }, [contract.fee]);
  const isUserRejected = (contract.error ?? "").toLowerCase().includes("transaction cancelled");
  const canResumePending =
    contract.status === "timeout" && contract.sequenceNumber !== null;

  const handleDownloadReadingImage = useCallback(async () => {
    if (contract.cardIndex === null || isDownloadingReading) return;
    setIsDownloadingReading(true);
    setDownloadError(null);
    try {
      await downloadReadingAsPng({
        cardIndex: contract.cardIndex,
        cardOrientation,
        drawnDateStr: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        walletAddress: address,
        realm: answers?.realm,
        realmSymbol: answers?.realmSymbol,
        interpretation,
        sequenceNumberForFile: contract.sequenceNumber?.toString() ?? "export",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not download this reading.";
      setDownloadError(message);
    } finally {
      setIsDownloadingReading(false);
    }
  }, [
    address,
    contract.cardIndex,
    contract.sequenceNumber,
    isDownloadingReading,
    answers,
    interpretation,
    cardOrientation,
  ]);

  const handleLiveInterpretationComplete = useCallback(
    (fullText: string) => {
      if (!fullText.trim() || !answers) return;
      if (
        contract.cardIndex === null ||
        contract.sequenceNumber === null ||
        !contract.oracleSnapshotHash
      ) {
        return;
      }
      const seq = contract.sequenceNumber;
      const existing = readOrraReadingRecord(seq);
      if (existing?.interpretation === fullText) return;
      const priceStr =
        pythAtCommit != null
          ? formatPriceForOrraRecord({
              price: pythAtCommit.price,
              exponent: pythAtCommit.exponent,
            })
          : "—";
      saveOrraReadingRecord({
        cardIndex: contract.cardIndex,
        isReversed: contract.isReversed === true,
        asset: answers.realm,
        assetSymbol: answers.realmSymbol,
        price: priceStr,
        interpretation: fullText,
        timestamp: Date.now(),
        sequenceNumber: seq.toString(),
        txHash: contract.callbackTxHash || contract.requestTxHash || "",
        oracleSnapshotHash: contract.oracleSnapshotHash,
        requestTxHash: contract.requestTxHash ?? "",
      });
    },
    [
      answers,
      contract.cardIndex,
      contract.sequenceNumber,
      contract.isReversed,
      contract.oracleSnapshotHash,
      contract.callbackTxHash,
      contract.requestTxHash,
      pythAtCommit,
    ]
  );

  const handleDrawAgain = useCallback(() => {
    revealOnceRef.current = false;
    setSurfaceTab("reading");
    setInterpretation("");
    setPythAtCommit(null);
    setAnswers(null);
    contract.reset();
    setPhase("questions");
  }, [contract]);

  const showPostReadingTabs = phase === "revealed";

  const navigateSurface = useCallback(
    (tab: ReadingSurfaceTab) => {
      setSurfaceTab(tab);
      if (tab === "history" && phase === "intro") {
        setPhase("approach");
      }
      if (tab === "history" && address) {
        setMobileHistoryView('list');
        void loadPastReadingsForAddress(address);
      }
    },
    [address, phase]
  );

  const onReadingPortalEntered = useCallback(() => setPhase("approach"), []);
  const onReadingEnterClick = useCallback(() => {
    void readingAudio?.notifyEnterPortal();
  }, [readingAudio]);

  useRegisterReadingOrbitBindings({
    showEnterOverlay: phase === "intro",
    softenForContent: phase !== "intro",
    onPortalEntered: onReadingPortalEntered,
    onEnterClick: onReadingEnterClick,
  });

  return (
    <>
      {phase !== "intro" && (
        <header
          className="reading-fixed-util-header fixed left-4 right-4 top-0 z-[70] flex items-center justify-between gap-2 md:left-8 md:right-8"
          aria-label="Reading utilities"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            {surfaceTab === "history" && (
              <ReadingHistoryBackCta onClick={() => {
                if (mobileHistoryView === 'detail') setMobileHistoryView('list');
                else navigateSurface("reading");
              }} />
            )}
            <button
              type="button"
              onClick={() => navigateSurface("history")}
              className="group inline-flex items-center gap-1.5 px-0 py-1 text-[14px] font-medium text-ink-500 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:text-ink-900 hover:underline hover:underline-offset-4 hover:decoration-accent-light/70 focus-visible:-translate-y-0.5 focus-visible:text-ink-900 focus-visible:underline focus-visible:underline-offset-4 focus-visible:decoration-accent-light/70 active:translate-y-0 active:text-ink-700"
              aria-label="Open past readings"
            >
              <History
                className="h-4 w-4 text-ink-400 transition-colors duration-300 group-hover:text-ink-700 group-focus-visible:text-ink-700"
                aria-hidden
              />
              Past Readings
            </button>
          </div>
          <div className="shrink-0">
            <ReadingWalletHeader />
          </div>
        </header>
      )}
      <main
        className={`relative z-10 ${
          phase === "intro" || phase === "approach"
            ? `reading-main--fill-viewport flex flex-col${phase === "intro" ? " pointer-events-none" : ""}`
            : ""
        } ${phase !== "intro" ? "reading-main-below-util-header" : ""}`}
      >
        {phase === "approach" && surfaceTab === "reading" && (
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
            {!isConnected ? (
              <div className="flex flex-col items-center gap-3">
                <p className="reading-approach-sub max-w-sm font-sans text-center text-[13px] font-medium leading-relaxed text-ink-600">
                  Connect your wallet to be seen.
                </p>
                <ReadingConnectPrimary />
              </div>
            ) : (
              <ReadingApproachReadyCta onClick={() => setPhase("questions")} />
            )}
            <button
              type="button"
              onClick={() => setIsHowItWorksOpen(true)}
              className="text-[12px] font-medium text-ink-500 underline underline-offset-4 decoration-ink-300/70 transition-colors hover:text-ink-800 hover:decoration-ink-600"
              aria-haspopup="dialog"
              aria-expanded={isHowItWorksOpen}
              aria-controls="how-it-works-modal"
            >
              How it works
            </button>
          </div>
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
                    Verifiable draw pipeline
                  </p>
                  <p className="text-[12px] text-ink-500 leading-relaxed">
                    One oracle snapshot hash + one entropy callback. Everything below can be independently verified on-chain.
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
                <li className="text-left">
                  You answer realm, stance, timeframe, and truth. These become the structured reading context.
                </li>
                <li className="text-left">
                  On draw, Orra submits <span className="font-sans tabular text-[11px] text-ink-700">requestReading(feedId, oracleSnapshotHash)</span>; the hash commits the frozen Pyth fields.
                </li>
                <li className="text-left">
                  Pyth Entropy fulfills the request in a callback tx and returns a 32-byte random value.
                </li>
                <li className="text-left">
                  Card index is deterministic from that random value. Reversal uses bit 8:
                  <span className="ml-1 font-sans tabular text-[11px] text-ink-700">((randomNumber {">>"} 8) % 2) == 1</span>
                  means reversed; otherwise upright.
                </li>
                <li className="text-left">
                  <span className="font-sans tabular text-[11px] text-ink-700">CardDrawn</span> emits sequence, oracle hash, card index, and randomness. Interpretation is generated afterward from your answers + drawn result + committed oracle context.
                </li>
              </ol>
              <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
                Audit shortcut: verify request tx, callback tx, oracle snapshot hash, and raw feed inputs in the receipt. Matching values prove the draw path and reversal state.
              </p>
          </div>
        </div>

        {(surfaceTab === "history" || (phase !== "intro" && phase !== "approach")) && (
        <div
          className={`max-w-5xl mx-auto flex w-full min-h-0 flex-col px-4 sm:px-6 ${
            surfaceTab === "history"
              ? "reading-history-scroll-host items-stretch gap-0 overflow-hidden"
              : " items-center gap-10 pb-16 pt-4"
          }`}
        >
          {surfaceTab === "history" && (
            <div className="reading-history-inner min-w-0 overflow-hidden">
              <MyReadings key={address ?? "none"} mobileView={mobileHistoryView} setMobileView={setMobileHistoryView} />
            </div>
          )}

          {surfaceTab === "reading" && (
          <>
          {phase === "questions" && (
            <QuestionFlow onComplete={handleQuestionsComplete} initialAnswers={answers} />
          )}

          {phase === "connect" && (
            <div className="reading-phase-min-h flex w-full flex-col items-center justify-center gap-8 pb-6 opacity-0 animate-fade-up">
              <h2 className="text-[20px] font-light text-ink-900 text-center leading-relaxed">
                The oracle requires a connection to the chain
              </h2>
              <p className="text-[12px] font-medium text-ink-400 text-center leading-relaxed max-w-sm">
                Connect your wallet on Base to draw a card from the Entropy oracle.
                The reading fee is paid in ETH.
              </p>
              {!isConnected ? (
                <ReadingConnectInline />
              ) : (
                <ReadingRitualOracleCta
                  label="Proceed"
                  ariaLabel="Proceed to reading confirmation"
                  onClick={() => {
                    setPhase("confirm");
                    contract.fetchFee();
                  }}
                  glyph={<ReadingOracleIconChevron />}
                />
              )}
            </div>
          )}

          {phase === "confirm" && (
            <div className="reading-phase-min-h flex w-full flex-col items-center justify-center gap-8 pb-6 opacity-0 animate-fade-up">
              <div className="opacity-0 animate-fade-up-1">
                <ReadingApproachLogoLoader />
              </div>
              <h2 className="text-[20px] font-light text-ink-900 text-center">
                The oracle awaits your offering
              </h2>
              <div className="card-surface px-8 py-5 text-center">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-ink-400 mb-2">reading fee</p>
                <p className="text-[28px] font-extralight text-ink-900 tabular">{feeDisplay}</p>
                <p className="text-[10px] text-ink-400 mt-3 leading-relaxed max-w-xs mx-auto">
                  Drawing seals the current Pyth tick on-chain (feed id + snapshot hash) with your Entropy request.
                </p>
              </div>
              <ReadingRitualOracleCta
                label="Draw the card"
                ariaLabel="Draw the card from the entropy oracle"
                onClick={handleConfirm}
                disabled={!!readingBlockedReason}
                glyph={<ReadingOracleIconCards />}
              />
              <button
                type="button"
                onClick={() => setPhase("questions")}
                aria-label="Return to the inquiry before sealing the draw"
                className="text-[12px] font-medium text-ink-500 underline underline-offset-4 decoration-ink-300/60 hover:text-ink-700 hover:decoration-ink-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-400"
              >
                Return to the inquiry
              </button>
              {readingBlockedReason && (
                <p className="text-[11px] font-medium text-danger text-center max-w-sm leading-relaxed">
                  {readingBlockedReason}
                </p>
              )}
            </div>
          )}

          {phase === "waiting" &&
            (contract.status === "error" || contract.status === "timeout" ? (
              <div className="reading-phase-min-h flex w-full flex-col items-center justify-center gap-6 pb-6 opacity-0 animate-fade-up">
                <div className="opacity-0 animate-fade-up-1">
                  <ReadingApproachLogoLoader />
                </div>
                <h2 className="text-[20px] font-light text-ink-900 text-center">
                  {contract.status === "timeout"
                    ? "The oracle is slow to respond"
                    : "The oracle encountered an error"}
                </h2>
                {contract.error && (
                  <p className="text-[12px] font-medium text-danger text-center max-w-sm leading-relaxed">
                    {contract.error}
                  </p>
                )}
                <div className="flex flex-col items-center gap-3">
                  <ReadingRitualOracleCta
                    label={
                      canResumePending
                        ? "Keep waiting"
                        : isUserRejected
                          ? "Draw card again"
                          : "Try again"
                    }
                    ariaLabel="Retry wallet transaction"
                    onClick={canResumePending ? contract.resumePendingReading : handleConfirm}
                    disabled={!canResumePending && !!readingBlockedReason}
                    glyph={<ReadingOracleIconCards />}
                  />
                  {!canResumePending && readingBlockedReason && (
                    <p className="text-[11px] font-medium text-danger text-center max-w-sm leading-relaxed">
                      {readingBlockedReason}
                    </p>
                  )}
                </div>
              </div>
            ) : contract.status === "requesting" ? (
              <div className="w-full max-w-lg mx-auto opacity-0 animate-fade-up">
                <ShufflePhase
                  key={waitingEpoch}
                  isDrawComplete={false}
                  contractStatus={contract.status}
                  onSettleComplete={() => {}}
                />
              </div>
            ) : (
              <div className="fixed inset-0 z-30 flex items-center justify-center">
                <SpreadPhase
                  cardIndex={contract.cardIndex}
                  onComplete={() => {
                    void handleReveal();
                  }}
                />
              </div>
            ))}

          {phase === "revealed" && contract.cardIndex !== null && (
            <div className="flex w-full flex-col items-center gap-6">
              <div className="relative z-20 flex w-full flex-col items-center">
                <CardReveal cardIndex={contract.cardIndex} orientation={cardOrientation} />
              </div>
              <div className="relative z-10 flex flex-row flex-wrap w-full max-w-2xl items-center justify-center gap-3">
                <div className="flex min-w-[12rem] flex-col items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { void handleDownloadReadingImage(); }}
                    disabled={isDownloadingReading}
                    className="oracle-button reading-nav-oracle-cta reading-nav-oracle-cta--compact reading-nav-oracle-cta--no-pulse"
                    aria-label="Download reading image"
                  >
                    <span className="reading-nav-oracle-cta-inner">
                      <svg
                        className="oracle-button-svg"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden
                      >
                        <path d="M11 4h2v8.25l2.85-2.85 1.4 1.4L12 16.05l-5.25-5.25 1.4-1.4L11 12.25V4z" />
                        <path d="M5 17h14v3H5v-3z" opacity={0.6} />
                      </svg>
                      <span className="oracle-button-txt-wrap">
                        <span className="oracle-button-txt oracle-button-txt-1" aria-hidden>
                          {Array.from(isDownloadingReading ? "Saving…" : "Download Reading").map((ch, i) => (
                            <span key={`share-a-${i}`} className="oracle-button-letter">
                              {ch === " " ? "\u00a0" : ch}
                            </span>
                          ))}
                        </span>
                        <span className="oracle-button-txt oracle-button-txt-2" aria-hidden>
                          {Array.from(isDownloadingReading ? "Saving…" : "Download Reading").map((ch, i) => (
                            <span key={`share-b-${i}`} className="oracle-button-letter">
                              {ch === " " ? "\u00a0" : ch}
                            </span>
                          ))}
                        </span>
                      </span>
                    </span>
                  </button>
                  {downloadError && (
                    <p className="text-center text-[11px] font-medium text-danger">
                      {downloadError}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleDrawAgain}
                  className="oracle-button reading-nav-oracle-cta reading-nav-oracle-cta--compact reading-nav-oracle-cta--no-pulse"
                  aria-label="Draw again"
                >
                  <span className="reading-nav-oracle-cta-inner">
                    <svg
                      className="oracle-button-svg"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path d="M12 5a7 7 0 0 1 6.7 5H16v2h6V6h-2v2.2A9 9 0 1 0 21 13h-2a7 7 0 1 1-7-8z" />
                    </svg>
                    <span className="oracle-button-txt-wrap">
                      <span className="oracle-button-txt oracle-button-txt-1" aria-hidden>
                        {Array.from("Draw Again").map((ch, i) => (
                          <span key={`draw-a-${i}`} className="oracle-button-letter">
                            {ch === " " ? "\u00a0" : ch}
                          </span>
                        ))}
                      </span>
                      <span className="oracle-button-txt oracle-button-txt-2" aria-hidden>
                        {Array.from("Draw Again").map((ch, i) => (
                          <span key={`draw-b-${i}`} className="oracle-button-letter">
                            {ch === " " ? "\u00a0" : ch}
                          </span>
                        ))}
                      </span>
                    </span>
                  </span>
                </button>
              </div>
              <div className="relative z-0 w-full max-w-2xl">
                <Interpretation
                  key={
                    contract.sequenceNumber != null
                      ? contract.sequenceNumber.toString()
                      : "interpretation"
                  }
                  text={interpretation}
                  instantSurface
                  onTypewriterComplete={handleLiveInterpretationComplete}
                />
              </div>
              <div className="relative z-0 w-full max-w-2xl">
                <ReadingReceipt
                  sequenceNumber={contract.sequenceNumber}
                  feedId={contract.feedId}
                  feedSymbol={answers?.realm ?? answers?.realmSymbol ?? null}
                  oracleSnapshotHash={contract.oracleSnapshotHash}
                  attestedRaw={pythAtCommit}
                />
              </div>
              <div className="relative z-0 w-full max-w-2xl">
                <EntropyProof
                  sequenceNumber={contract.sequenceNumber}
                  requestTxHash={contract.requestTxHash}
                  callbackTxHash={contract.callbackTxHash}
                />
              </div>
            </div>
          )}
          </>
          )}
        </div>
        )}
      </main>
    </>
  );
}


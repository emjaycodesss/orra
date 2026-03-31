"use client";

import { useState, useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { AssetSearch, type AssetWhisperEntry } from "@/components/dashboard/AssetSearch";
import {
  ReadingOracleIconCards,
  ReadingOracleIconChevron,
  ReadingRitualOracleCta,
} from "@/components/reading/ReadingWalletHud";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import { inferAssetClass, type AssetClass } from "@/lib/asset-class";
import { getMarketStatus } from "@/lib/market-hours";
import { oracleWhisperStore, type WhisperData } from "@/lib/oracle-whispers";
import type { MarketSession } from "@/lib/oracleState";

export interface OracleAnswers {
  realmFeedId: number;
  realmSymbol: string;
  realm: string;
  stance: string;
  timeframe: string;
  truth: string;
}

interface Props {
  onComplete: (answers: OracleAnswers) => void;
  initialAnswers?: OracleAnswers | null;
}

const POSITION_OPTIONS = [
  "I'm already in — holding a position",
  "I'm watching — considering entry",
  "I'm thinking about getting out",
  "No position — just seeking clarity",
];

const INTENT_OPTIONS = [
  "I need clarity on a decision",
  "I'm feeling uncertain and want grounding",
  "My instinct says one thing, the data says another",
  "I just want to see what the oracle says",
];

function getTimeframeOptions(
  assetClass: AssetClass,
  marketSession: MarketSession,
): string[] {
  if (assetClass === "crypto") {
    return [
      "Next few hours",
      "Before the daily close (midnight UTC)",
      "This week",
      "This month",
    ];
  }
  if (assetClass === "equity") {
    if (marketSession === "preMarket") {
      return [
        "Before market open today",
        "Today's regular session",
        "This week's trading sessions",
        "Before next earnings",
      ];
    }
    if (marketSession === "regular") {
      return [
        "Before market close today",
        "This week's trading sessions",
        "Before next earnings",
        "Long term — thinking in quarters",
      ];
    }
    return [
      "Tomorrow's session",
      "This week's trading sessions",
      "Before next earnings",
      "Long term — thinking in quarters",
    ];
  }
  if (assetClass === "fx") {
    return [
      "This session",
      "Before the weekly close (Friday 5pm ET)",
      "This month",
    ];
  }
  return [
    "Before today's CME close",
    "This week",
    "This month",
  ];
}

function marketSessionForAsset(assetClass: AssetClass): MarketSession {
  const marketStatus = getMarketStatus(assetClass);
  if (assetClass === "crypto") return "regular";
  if (marketStatus.label === "Open") return "regular";
  if (marketStatus.label === "Pre-market") return "preMarket";
  if (marketStatus.label === "After-hours") return "postMarket";
  return "closed";
}

function hydrateFromAnswers(a: OracleAnswers) {
  const assetClass = inferAssetClass(a.realmSymbol || "BTC/USD");
  const marketSession = marketSessionForAsset(assetClass);
  const tfOpts = getTimeframeOptions(assetClass, marketSession);
  const tfIsPreset = tfOpts.includes(a.timeframe);
  const intentIsPreset = INTENT_OPTIONS.includes(a.truth);

  return {
    realmFeedId: a.realmFeedId,
    realmSymbol: a.realmSymbol,
    realmName: a.realm,
    position: a.stance,
    timeframe: tfIsPreset ? a.timeframe : "",
    timeframeCustom: tfIsPreset ? "" : a.timeframe,
    timeframeIsCustom: !tfIsPreset,
    intent: intentIsPreset ? a.truth : "",
    intentCustom: intentIsPreset ? "" : a.truth,
    intentIsCustom: !intentIsPreset,
  };
}

type Step = 0 | 1 | 2 | 3;

export function QuestionFlow({ onComplete, initialAnswers }: Props) {
  const seeded = initialAnswers ? hydrateFromAnswers(initialAnswers) : null;

  const [step, setStep] = useState<Step>(0);

  const [realmFeedId, setRealmFeedId] = useState(() => seeded?.realmFeedId ?? 0);
  const [realmSymbol, setRealmSymbol] = useState(() => seeded?.realmSymbol ?? "");
  const [realmName, setRealmName] = useState(() => seeded?.realmName ?? "");

  const [position, setPosition] = useState(() => seeded?.position ?? "");
  const [timeframe, setTimeframe] = useState(() => seeded?.timeframe ?? "");
  const [timeframeCustom, setTimeframeCustom] = useState(() => seeded?.timeframeCustom ?? "");
  const [timeframeIsCustom, setTimeframeIsCustom] = useState(() => seeded?.timeframeIsCustom ?? false);
  const [intent, setIntent] = useState(() => seeded?.intent ?? "");
  const [intentCustom, setIntentCustom] = useState(() => seeded?.intentCustom ?? "");
  const [intentIsCustom, setIntentIsCustom] = useState(() => seeded?.intentIsCustom ?? false);

  const whisperHydratePrimedRef = useRef(false);
  if (initialAnswers?.realmFeedId && initialAnswers.realmFeedId > 0 && !whisperHydratePrimedRef.current) {
    whisperHydratePrimedRef.current = true;
    const fid = initialAnswers.realmFeedId;
    queueMicrotask(() => oracleWhisperStore.fetchWhispers([fid]));
  }

  const whisperCache = useSyncExternalStore(
    oracleWhisperStore.subscribe,
    oracleWhisperStore.getSnapshot,
    oracleWhisperStore.getServerSnapshot,
  );

  const whisperMap = useMemo(() => {
    const map = new Map<number, AssetWhisperEntry>();
    whisperCache.forEach((w: WhisperData, id: number) => {
      const clarityClass = w.isStale ? "stale" : w.signalClarity;
      map.set(id, {
        whisper: w.whisper,
        clarityClass,
        publisherCount: Number.isFinite(w.publisherCount) ? w.publisherCount : 0,
      });
    });
    return map;
  }, [whisperCache]);

  const handleResultsVisible = useCallback((feedIds: number[]) => {
    oracleWhisperStore.fetchWhispers(feedIds);
  }, []);

  const assetClass = useMemo(
    () => inferAssetClass(realmSymbol || "BTC/USD"),
    [realmSymbol],
  );
  const marketStatus = useMemo(() => getMarketStatus(assetClass), [assetClass]);
  const marketSession: MarketSession = useMemo(() => {
    if (assetClass === "crypto") return "regular";
    if (marketStatus.label === "Open") return "regular";
    if (marketStatus.label === "Pre-market") return "preMarket";
    if (marketStatus.label === "After-hours") return "postMarket";
    return "closed";
  }, [assetClass, marketStatus.label]);

  const timeframeOptions = useMemo(
    () => getTimeframeOptions(assetClass, marketSession),
    [assetClass, marketSession],
  );

  const canAdvance = useMemo(() => {
    if (step === 0) return realmFeedId > 0;
    if (step === 1) return position.length > 0;
    if (step === 2) {
      if (timeframeIsCustom) return timeframeCustom.trim().length >= 3;
      return timeframe.length > 0;
    }
    if (step === 3) {
      if (intentIsCustom) return intentCustom.trim().length >= 3;
      return intent.length > 0;
    }
    return false;
  }, [step, realmFeedId, position, timeframe, timeframeCustom, timeframeIsCustom, intent, intentCustom, intentIsCustom]);

  const handleNext = useCallback(() => {
    if (!canAdvance) return;
    if (step === 3) {
      onComplete({
        realmFeedId,
        realmSymbol,
        realm: realmName,
        stance: position,
        timeframe: timeframeIsCustom ? timeframeCustom.trim() : timeframe,
        truth: intentIsCustom ? intentCustom.trim() : intent,
      });
      return;
    }
    setStep((s) => Math.min(3, s + 1) as Step);
  }, [
    canAdvance, step, onComplete,
    realmFeedId, realmSymbol, realmName,
    position, timeframe, timeframeCustom, timeframeIsCustom,
    intent, intentCustom, intentIsCustom,
  ]);

  const handlePrevious = useCallback(() => {
    setStep((s) => {
      const next = Math.max(0, s - 1) as Step;
      if (next === 0 && realmFeedId > 0) {
        oracleWhisperStore.fetchWhispers([realmFeedId]);
      }
      return next;
    });
  }, [realmFeedId]);

  const handleSelectAsset = useCallback(
    (feedId: number, symbol: string, name: string) => {
      setRealmFeedId(feedId);
      setRealmSymbol(symbol);
      setRealmName(name);
      oracleWhisperStore.fetchWhispers([feedId]);
    },
    [],
  );

  const handlePositionSelect = useCallback((opt: string) => {
    setPosition(opt);
  }, []);

  const handleTimeframeSelect = useCallback((opt: string) => {
    setTimeframe(opt);
    setTimeframeIsCustom(false);
    setTimeframeCustom("");
  }, []);

  const handleTimeframeCustomToggle = useCallback(() => {
    setTimeframeIsCustom(true);
    setTimeframe("");
  }, []);

  const handleTimeframeCustomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTimeframeCustom(e.target.value);
    },
    [],
  );

  const handleIntentSelect = useCallback((opt: string) => {
    setIntent(opt);
    setIntentIsCustom(false);
    setIntentCustom("");
  }, []);

  const handleIntentCustomToggle = useCallback(() => {
    setIntentIsCustom(true);
    setIntent("");
  }, []);

  const handleIntentCustomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setIntentCustom(e.target.value);
    },
    [],
  );

  const dotStates = useMemo(() => {
    const answered = [
      position.length > 0,
      timeframeIsCustom ? timeframeCustom.trim().length >= 3 : timeframe.length > 0,
      intentIsCustom ? intentCustom.trim().length >= 3 : intent.length > 0,
    ];
    return [1, 2, 3].map((qStep) => {
      if (answered[qStep - 1]) return "filled" as const;
      if (step === qStep) return "pulsing" as const;
      return "hollow" as const;
    });
  }, [step, position, timeframe, timeframeCustom, timeframeIsCustom, intent, intentCustom, intentIsCustom]);

  const selectedWhisper = realmFeedId > 0 ? whisperMap.get(realmFeedId) : undefined;

  const nextLabel = "Next";

  return (
    <div className="qflow-root w-full max-w-lg mx-auto flex flex-col items-center gap-8">
      <div
        className={`qflow-step w-full ${step === 0 ? "qflow-step--active" : "qflow-step--inactive"}`}
        aria-hidden={step !== 0}
      >
        <div className="w-full -translate-y-8 sm:-translate-y-12 md:-translate-y-14">
          <div className="reading-phase-min-h flex w-full flex-col items-center justify-center gap-6 pb-6 opacity-0 animate-fade-up">
          <div className="reading-approach-logo-shell">
            <ReadingApproachLogoLoader />
          </div>
          <h2 className="text-[18px] font-light text-ink-900 text-center leading-relaxed">
            Which realm shall the oracle illuminate?
          </h2>
          <AssetSearch
            variant="cosmic"
            onSelect={handleSelectAsset}
            whisperMap={whisperMap}
            onResultsVisible={handleResultsVisible}
          />
          {realmFeedId > 0 && (
            <div className="w-[392px] max-w-full flex flex-col items-stretch gap-6">
              <div className="w-full card-surface card-surface-static !rounded-xl overflow-hidden !p-0">
                <div className="px-4 pt-3 pb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300">
                    Selected Realm
                  </span>
                </div>
                <div className="w-full px-4 py-2.5 text-left flex items-center justify-between">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[13px] sm:text-sm font-semibold tabular-nums text-ink-900 tracking-wide">
                      {realmName}
                    </span>
                    <span className={`qflow-whisper text-[11px] sm:text-xs ${selectedWhisper ? `qflow-whisper--${selectedWhisper.clarityClass}` : "qflow-whisper--stale"}`}>
                      {selectedWhisper ? selectedWhisper.whisper : "Syncing oracle signal..."}
                      {selectedWhisper && (
                        <span className="text-ink-400 text-[10px] sm:text-[11px]">
                          {" "}
                          ● {selectedWhisper.publisherCount} publishers
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-0.5">
                    <span className="text-xs sm:text-[13px] font-medium text-ink-400 truncate">{realmSymbol || realmName}</span>
                    <span
                      className="text-[10px] font-semibold uppercase tracking-widest"
                      style={{
                        color: selectedWhisper
                          ? selectedWhisper.clarityClass === "stale"
                            ? "var(--ink-400)"
                            : "var(--positive)"
                          : "var(--ink-400)",
                      }}
                    >
                      {selectedWhisper ? (selectedWhisper.clarityClass === "stale" ? "Stale" : "Live") : "Syncing"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-full flex justify-end">
                <ReadingRitualOracleCta
                  label="Next"
                  ariaLabel="Continue to question flow"
                  onClick={() => setStep(1)}
                  glyph={<ReadingOracleIconChevron />}
                />
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      <div
        className={`qflow-step w-full ${step === 1 ? "qflow-step--active" : "qflow-step--inactive"}`}
        aria-hidden={step !== 1}
      >
        <div className="qflow-question-stage opacity-0 animate-fade-up" key="q1">
          <div className="reading-approach-logo-shell qflow-question-logo">
            <ReadingApproachLogoLoader />
          </div>
          <div className="flex items-center gap-3" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
            {dotStates.map((state, i) => (
              <span
                key={i}
                className={`qflow-dot qflow-dot--${state}`}
                aria-label={`Question ${i + 1}: ${state}`}
              />
            ))}
          </div>
          <h2 className="text-[18px] font-light text-ink-900 text-center leading-relaxed">
            Where do you stand with this asset?
          </h2>
          <div className="qflow-option-list">
            {POSITION_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`qflow-option ${position === opt ? "qflow-option--selected" : ""}`}
                onClick={() => handlePositionSelect(opt)}
              >
                <span className={`qflow-radio ${position === opt ? "qflow-radio--checked" : ""}`} />
                <span className="qflow-option-copy text-[13px] font-medium leading-snug">{opt}</span>
              </button>
            ))}
          </div>
          <div className="qflow-nav-row">
            <button
              type="button"
              onClick={handlePrevious}
              className="qflow-nav-btn text-ink-400 hover:text-ink-700 transition-colors duration-150"
            >
              ← Previous
            </button>
            <ReadingRitualOracleCta
              label={nextLabel}
              ariaLabel={nextLabel}
              onClick={handleNext}
              disabled={!canAdvance}
              glyph={<ReadingOracleIconChevron />}
            />
          </div>
        </div>
      </div>

      <div
        className={`qflow-step w-full ${step === 2 ? "qflow-step--active" : "qflow-step--inactive"}`}
        aria-hidden={step !== 2}
      >
        <div className="qflow-question-stage opacity-0 animate-fade-up" key="q2">
          <div className="reading-approach-logo-shell qflow-question-logo">
            <ReadingApproachLogoLoader />
          </div>
          <div className="flex items-center gap-3" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
            {dotStates.map((state, i) => (
              <span
                key={i}
                className={`qflow-dot qflow-dot--${state}`}
                aria-label={`Question ${i + 1}: ${state}`}
              />
            ))}
          </div>
          <h2 className="text-[18px] font-light text-ink-900 text-center leading-relaxed">
            How far are you looking?
          </h2>
          <div className="qflow-option-list">
            {timeframeOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`qflow-option ${!timeframeIsCustom && timeframe === opt ? "qflow-option--selected" : ""}`}
                onClick={() => handleTimeframeSelect(opt)}
              >
                <span className={`qflow-radio ${!timeframeIsCustom && timeframe === opt ? "qflow-radio--checked" : ""}`} />
                <span className="qflow-option-copy text-[13px] font-medium leading-snug">{opt}</span>
              </button>
            ))}
            <button
              type="button"
              className={`qflow-option ${timeframeIsCustom ? "qflow-option--selected" : ""}`}
              onClick={handleTimeframeCustomToggle}
            >
              <span className={`qflow-radio ${timeframeIsCustom ? "qflow-radio--checked" : ""}`} />
              <span className="qflow-option-copy text-[13px] font-medium leading-snug">Let me be specific...</span>
            </button>
            {timeframeIsCustom && (
              <div className="qflow-custom-wrap qflow-custom-wrap--enter pl-8 pr-2 pb-1">
                <input
                  type="text"
                  value={timeframeCustom}
                  onChange={handleTimeframeCustomChange}
                  placeholder='e.g. "before the Fed meeting Thursday" or "before my options expire Friday"'
                  className="qflow-custom-input"
                  autoFocus
                />
              </div>
            )}
          </div>
          <div className="qflow-nav-row">
            <button
              type="button"
              onClick={handlePrevious}
              className="qflow-nav-btn text-ink-400 hover:text-ink-700 transition-colors duration-150"
            >
              ← Previous
            </button>
            <ReadingRitualOracleCta
              label={nextLabel}
              ariaLabel={nextLabel}
              onClick={handleNext}
              disabled={!canAdvance}
              glyph={<ReadingOracleIconChevron />}
            />
          </div>
        </div>
      </div>

      <div
        className={`qflow-step w-full ${step === 3 ? "qflow-step--active" : "qflow-step--inactive"}`}
        aria-hidden={step !== 3}
      >
        <div className="qflow-question-stage opacity-0 animate-fade-up" key="q3">
          <div className="reading-approach-logo-shell qflow-question-logo">
            <ReadingApproachLogoLoader />
          </div>
          <div className="flex items-center gap-3" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
            {dotStates.map((state, i) => (
              <span
                key={i}
                className={`qflow-dot qflow-dot--${state}`}
                aria-label={`Question ${i + 1}: ${state}`}
              />
            ))}
          </div>
          <h2 className="text-[18px] font-light text-ink-900 text-center leading-relaxed">
            What brings you to the oracle?
          </h2>
          <div className="qflow-option-list">
            {INTENT_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`qflow-option ${!intentIsCustom && intent === opt ? "qflow-option--selected" : ""}`}
                onClick={() => handleIntentSelect(opt)}
              >
                <span className={`qflow-radio ${!intentIsCustom && intent === opt ? "qflow-radio--checked" : ""}`} />
                <span className="qflow-option-copy text-[13px] font-medium leading-snug">{opt}</span>
              </button>
            ))}
            <button
              type="button"
              className={`qflow-option ${intentIsCustom ? "qflow-option--selected" : ""}`}
              onClick={handleIntentCustomToggle}
            >
              <span className={`qflow-radio ${intentIsCustom ? "qflow-radio--checked" : ""}`} />
              <span className="qflow-option-copy text-[13px] font-medium leading-snug">Something else...</span>
            </button>
            {intentIsCustom && (
              <div className="qflow-custom-wrap qflow-custom-wrap--enter pl-8 pr-2 pb-1">
                <input
                  type="text"
                  value={intentCustom}
                  onChange={handleIntentCustomChange}
                  placeholder="Describe what's on your mind..."
                  className="qflow-custom-input"
                  autoFocus
                />
              </div>
            )}
          </div>
          <div className="qflow-nav-row">
            <button
              type="button"
              onClick={handlePrevious}
              className="qflow-nav-btn text-ink-400 hover:text-ink-700 transition-colors duration-150"
            >
              ← Previous
            </button>
            <ReadingRitualOracleCta
              label={nextLabel}
              ariaLabel={nextLabel}
              onClick={handleNext}
              disabled={!canAdvance}
              glyph={<ReadingOracleIconChevron />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

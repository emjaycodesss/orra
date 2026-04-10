"use client";
import { useRef } from "react";
import {
  BookOpen,
  Divide,
  Eye,
  EyeOff,
  Flame,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Sun,
  Swords,
  AlertTriangle,
  Wand2,
} from "lucide-react";
import type { ClientQuestion, GameSession } from "@/lib/game/types";

const ICON_MAP: Record<string, React.ElementType> = {
  Wand2,
  Shield,
  Swords,
  RefreshCw,
  EyeOff,
  Scale,
  Eye,
  Sun,
  BookOpen,
  Divide,
  Flame,
  Sparkles,
};

interface EffectTag {
  label: string;
  tone: "attack" | "defend" | "wild";
  icon: string;
}

interface Props {
  q: ClientQuestion | null;
  /** Parent-latched latest non-null question to avoid null blackout frames */
  fallbackQuestion?: ClientQuestion | null;
  lastQuestion?: ClientQuestion | null;
  lastAnswer?: GameSession["lastAnswer"];
  effectTags?: EffectTag[];
  busy: boolean;
  canAnswer?: boolean;
  suddenDeath: boolean;
  awaitingSuddenDeath: boolean;
  /** Controlled by GameDuelPanel — true when server confirmed the answer */
  isRevealing: boolean;
  /** Captured at answer/timeout — reveal prefers this, then `lastQuestion`, then live `q` (stable under fast polls). */
  revealQuestion?: ClientQuestion | null;
  /** Index highlighted immediately after click (before server responds) */
  localSelectedIndex: number | null;
  /** Bool highlighted immediately after click for TF questions */
  localSelectedBool: boolean | null;
  onAnswerTf: (v: boolean) => void;
  onAnswerMcq: (idx: number) => void;
  timerRemain?: number;
}

export function DuelQuestionPanel({
  q,
  fallbackQuestion,
  lastQuestion,
  lastAnswer,
  effectTags,
  busy,
  canAnswer = true,
  suddenDeath,
  awaitingSuddenDeath,
  isRevealing,
  revealQuestion,
  localSelectedIndex,
  localSelectedBool,
  onAnswerTf,
  onAnswerMcq,
  timerRemain = 0,
}: Props) {
  const revealDisplayQ = revealQuestion ?? lastQuestion ?? q ?? fallbackQuestion ?? null;
  const displayQ = isRevealing ? revealDisplayQ : (q ?? fallbackQuestion ?? null);
  const stableQuestionRef = useRef<ClientQuestion | null>(displayQ ?? null);
  if (displayQ) {
    stableQuestionRef.current = displayQ;
  }
  const renderQ = displayQ ?? stableQuestionRef.current;
  const showFeedback = isRevealing && Boolean(lastAnswer);

  const promptCopy = suddenDeath
    ? "⚔️ Sudden death."
    : renderQ?.type === "tf"
      ? "True or false."
      : "Pick the best answer.";

  const visibleTags = effectTags?.slice(0, 3) ?? [];
  const overflowCount = (effectTags?.length ?? 0) - visibleTags.length;

  return (
    <section className="duel-question-section">
      <div className="duel-question-container">
        {visibleTags.length > 0 && (
          <div className="duel-effects-row" aria-label="Active effects">
            {visibleTags.map((tag) => {
              const Icon = ICON_MAP[tag.icon] ?? Sparkles;
              return (
                <span
                  key={tag.label}
                  className={`duel-effect-badge duel-effect-badge--${tag.tone}`}
                >
                  <Icon size={11} aria-hidden />
                  <span className="text-xs font-medium">{tag.label}</span>
                </span>
              );
            })}
            {overflowCount > 0 && (
              <span className="duel-effect-badge duel-effect-badge--more">
                +{overflowCount} more
              </span>
            )}
          </div>
        )}

        {displayQ?.tfLean && (
          <div className="duel-status-hint duel-status-hint--hint">
            Oracle leans <span className="font-semibold">{displayQ.tfLean === "true" ? "True" : "False"}</span>.
          </div>
        )}
        {suddenDeath && awaitingSuddenDeath && (
          <div className="duel-status-hint duel-status-hint--danger">
            <AlertTriangle size={14} aria-hidden />
            <span>Sudden death — one wrong answer ends your run</span>
          </div>
        )}
        <div className="mb-4">
          <h2 className="duel-question-stem font-semibold text-ink-900 leading-snug">
            {renderQ ? renderQ.stem : "Loading next question..."}
          </h2>
          <p className="duel-question-prompt text-sm text-ink-500 mt-2">
            {promptCopy}
          </p>
        </div>

        <div className="duel-question-content card-surface-static rounded-xl p-4 sm:p-6 backdrop-blur-sm border-0">

          {renderQ ? (
            renderQ.type === "tf" ? (
              <div className="duel-choices-grid duel-choices-grid--two gap-3">
                {[
                  { label: "True", value: true },
                  { label: "False", value: false },
                ].map(({ label, value }) => {
                  const isUserPick = showFeedback
                    ? lastAnswer?.pickedBool === value
                    : localSelectedBool === value;
                  const isCorrect = showFeedback && lastAnswer?.answerBool === value;
                  /** Sun Arcana: outline the correct True/False before submit (same role as MCQ sunCorrectIndex). */
                  const isSunHint =
                    !showFeedback && renderQ.sunCorrectBool === value;

                  let stateClass = "";
                  if (showFeedback) {
                    if (isCorrect) {
                      stateClass = "duel-choice-btn--correct";
                    } else if (isUserPick) {
                      stateClass = "duel-choice-btn--wrong";
                    }
                  } else if (isUserPick) {
                    stateClass = "duel-choice-btn--selected";
                  }

                  return (
                    <button
                      key={label}
                      type="button"
                      className={`duel-choice-btn duel-choice-btn--primary ${
                        isSunHint ? "duel-choice-btn--hint" : ""
                      } ${stateClass}`}
                      onClick={() => {
                        if (canAnswer && !busy && !showFeedback && localSelectedBool === null) {
                          onAnswerTf(value);
                        }
                      }}
                      disabled={busy || !canAnswer || showFeedback || localSelectedBool !== null}
                      aria-label={`Answer ${label}`}
                    >
                      <span className="font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="duel-choices-grid gap-3">
                {(renderQ.options ?? []).map((label, idx) => {
                  const isEliminated = renderQ.eliminatedIndex === idx;
                  const isSunHint = renderQ.sunCorrectIndex === idx;
                  const isUserPick = showFeedback
                    ? lastAnswer?.pickedIndex === idx
                    : localSelectedIndex === idx;
                  const isCorrectAnswer = showFeedback && lastAnswer?.correctIndex === idx;

                  let stateClass = "";
                  if (showFeedback) {
                    if (isCorrectAnswer) {
                      stateClass = "duel-choice-btn--correct";
                    } else if (isUserPick) {
                      stateClass = "duel-choice-btn--wrong";
                    }
                  } else if (isUserPick) {
                    stateClass = "duel-choice-btn--selected";
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`duel-choice-btn ${
                        isEliminated ? "duel-choice-btn--eliminated" : ""
                      } ${isSunHint ? "duel-choice-btn--hint" : ""} ${stateClass}`}
                      onClick={() => {
                        if (canAnswer && !isEliminated && !busy && !showFeedback && localSelectedIndex === null && !isRevealing) {
                          onAnswerMcq(idx);
                        }
                      }}
                      disabled={busy || !canAnswer || isEliminated || showFeedback || localSelectedIndex !== null}
                      aria-label={`Answer: ${label}`}
                    >
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>
            )
          ) : (
            <div className="duel-loading-state">
              <div className="animate-pulse flex gap-2">
                <div className="w-2 h-2 bg-accent-light/60 rounded-full" />
                <div className="w-2 h-2 bg-accent-light/40 rounded-full" />
                <div className="w-2 h-2 bg-accent-light/20 rounded-full" />
              </div>
              <p className="text-xs text-ink-600 mt-2">Preparing next question...</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

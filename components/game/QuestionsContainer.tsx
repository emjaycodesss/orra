"use client";

import { CheckCircle, XCircle, Check } from "lucide-react";
import type { GameSession } from "@/lib/game/types";

interface QuestionsContainerProps {
  answerHistory: GameSession["answerHistory"];
  correctCount: number;
  totalQuestions: number;
  loading?: boolean;
}

export function QuestionsContainer({
  answerHistory,
  correctCount,
  totalQuestions,
  loading = false,
}: QuestionsContainerProps) {
  if (loading) {
    return (
      <div className="font-manrope">
        <div className="card-surface recap-card-static rounded-xl border border-[var(--surface-3)] p-4 sm:p-5 backdrop-blur-sm">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-4 sm:p-5 animate-pulse"
                style={{
                  background: "linear-gradient(135deg, var(--surface-3) 0%, var(--surface-2) 100%)",
                  opacity: 1 - i * 0.12,
                }}
              >
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-[var(--surface-4)] shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 rounded bg-[var(--surface-4)] w-3/4" />
                    <div className="h-3 rounded bg-[var(--surface-4)] w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-manrope">
      <div className="card-surface recap-card-static rounded-xl border border-[var(--surface-3)] p-4 sm:p-5 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-start justify-between mb-4">
          <div></div>
          <p className="text-xs text-ink-500 font-manrope">
            {correctCount} of {totalQuestions} correct
          </p>
        </div>
        <div className="space-y-4">
          {answerHistory.map((entry, i) => (
            <div
              key={`${entry.questionId}-${i}`}
              className="rounded-xl p-4 sm:p-5 animate-in fade-in slide-in-from-left-4 duration-300"
              style={{
                animationDelay: `${i * 50}ms`,
                background: "linear-gradient(135deg, var(--surface-3) 0%, var(--surface-2) 100%)",
                boxShadow: `
                  0 10px 25px rgba(0, 0, 0, 0.25),
                  0 4px 8px rgba(0, 0, 0, 0.15),
                  inset 0 1px 0 rgba(255, 255, 255, 0.08),
                  inset 0 -2px 4px rgba(0, 0, 0, 0.2)
                `
              }}
            >
              <div className="flex gap-3 mb-2">
                <div className="shrink-0 pt-0.5">
                  {entry.correct ? (
                    <CheckCircle
                      size={18}
                      className="text-emerald-500/80"
                      aria-label="Correct"
                    />
                  ) : (
                    <XCircle
                      size={18}
                      className="text-rose-500/80"
                      aria-label="Wrong"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-ink-900 mb-2 font-manrope font-semibold">
                    {entry.stem}
                  </p>

                  <p className="text-xs text-ink-500 mb-2 font-manrope">
                    You answered:{" "}
                    <span className="text-ink-700 font-medium">
                      {entry.pickedLabel || "No answer"}
                    </span>
                  </p>

                  {!entry.correct && entry.correctLabel && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-emerald-500/90 bg-emerald-500/5 px-2.5 py-1.5 rounded border border-emerald-500/20 font-manrope">
                      <Check size={12} aria-hidden />
                      <span className="font-medium">{entry.correctLabel}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-in {
          animation: fadeIn 0.3s ease-out forwards;
        }

        .slide-in-from-left-4 {
          animation: slideInFromLeft 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

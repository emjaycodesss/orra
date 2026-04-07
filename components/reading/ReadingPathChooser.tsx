"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import {
  ReadingOracleIconCards,
  ReadingRitualOracleCta,
} from "@/components/reading/ReadingWalletHud";

function PathArenaGlyph() {
  return (
    <svg
      className="oracle-button-svg"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 2.25l1.35 4.6 4.85.38-3.7 2.85 1.4 4.75L12 12.35 8.1 14.73l1.4-4.75-3.7-2.85 4.85-.38L12 2.25z"
        opacity={0.38}
      />
      <path d="M12 5.85l.85 2.95 3.1.22-2.38 1.82.9 3.05L12 11.65 9.53 13.89l.9-3.05-2.38-1.82 3.1-.22L12 5.85z" />
    </svg>
  );
}

export function ReadingPathChooser() {
  const router = useRouter();
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

  return (
    <div className="reading-approach-hero reading-path-chooser">
      <div className="reading-approach-logo-shell">
        <ReadingApproachLogoLoader />
      </div>

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
        className="grid w-full max-w-xl grid-cols-1 gap-5 sm:max-w-3xl sm:grid-cols-2 sm:gap-6"
        style={{
          animation: "fadeUp 1.7s cubic-bezier(0.16,1,0.3,1) 0.12s forwards",
          opacity: 0,
        }}
      >
        <div className="card-surface card-surface-static rounded-2xl px-5 py-6 shadow-[0_12px_40px_rgba(9,4,18,0.28)] sm:px-6 sm:py-7">
          <div className="flex flex-col items-center gap-3 sm:items-stretch">
            <ReadingRitualOracleCta
              label="Oracle Trivia Clash"
              ariaLabel="Open Oracle Trivia Clash — Pyth quiz duel"
              compact={false}
              onClick={() => router.push("/game")}
              glyph={<PathArenaGlyph />}
              className="reading-nav-oracle-cta--no-pulse w-full max-w-[min(100%,20rem)] sm:max-w-none"
            />
            <p className="text-balance text-center text-[12px] leading-relaxed text-[#4f4268] sm:text-left sm:px-0.5">
              Draw major-arcana boosters on-chain, then duel through oracle-tuned questions.
            </p>
          </div>
        </div>
        <div className="card-surface card-surface-static rounded-2xl px-5 py-6 shadow-[0_12px_40px_rgba(9,4,18,0.28)] sm:px-6 sm:py-7">
          <div className="flex flex-col items-center gap-3 sm:items-stretch">
            <ReadingRitualOracleCta
              label="Verifiable draw"
              ariaLabel="Continue to verifiable tarot draw at /reading"
              compact={false}
              onClick={() => router.push("/reading")}
              glyph={<ReadingOracleIconCards />}
              className="reading-nav-oracle-cta--no-pulse w-full max-w-[min(100%,20rem)] sm:max-w-none"
            />
            <p className="text-balance text-center text-[12px] leading-relaxed text-[#4f4268] sm:text-left sm:px-0.5">
              Realm, stance, and one card — hash-committed oracle context plus entropy callback.
            </p>
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
        </div>
      </div>
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
                One oracle snapshot hash + one entropy callback. Everything below can be independently verified
                on-chain.
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
              On draw, Orra submits{" "}
              <span className="font-sans tabular text-[11px] text-ink-700">
                requestReading(feedId, oracleSnapshotHash)
              </span>
              ; the hash commits the frozen Pyth fields.
            </li>
            <li className="text-left">
              Pyth Entropy fulfills the request in a callback tx and returns a 32-byte random value.
            </li>
            <li className="text-left">
              Card index is deterministic from that random value. Reversal uses bit 8:
              <span className="ml-1 font-sans tabular text-[11px] text-ink-700">
                ((randomNumber {">>"} 8) % 2) == 1
              </span>
              means reversed; otherwise upright.
            </li>
            <li className="text-left">
              <span className="font-sans tabular text-[11px] text-ink-700">CardDrawn</span> emits sequence, oracle
              hash, card index, and randomness. Interpretation is generated afterward from your answers + drawn
              result + committed oracle context.
            </li>
          </ol>
          <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
            Audit shortcut: verify request tx, callback tx, oracle snapshot hash, and raw feed inputs in the receipt.
            Matching values prove the draw path and reversal state.
          </p>
        </div>
      </div>
    </div>
  );
}

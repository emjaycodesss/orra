"use client";

import { Sparkles } from "lucide-react";
import { MAJOR_ARCANA } from "@/lib/cards";
import { CARD_EFFECTS } from "@/lib/game/card-effects";
import { CardReveal } from "@/components/reading/CardReveal";
import { ReadingRitualOracleCta } from "@/components/reading/ReadingWalletHud";
import { EntropyProof } from "@/components/reading/EntropyProof";

interface Props {
  boosters: [number, number, number];
  canStart: boolean;
  onStart: () => void;
  entropySequenceNumber: bigint | null;
  entropyRequestTxHash: string | null;
  entropyCallbackTxHash: string | null;
  /** True while `/api/game/prepare-run` is in flight (long LLM / oracle work). */
  preparingRun?: boolean;
  /** True after Start Clash until `start-run` returns (button already busy). */
  runStartPending?: boolean;
}

export function BoosterCardsReveal({
  boosters,
  canStart,
  onStart,
  entropySequenceNumber,
  entropyRequestTxHash,
  entropyCallbackTxHash,
  preparingRun = false,
  runStartPending = false,
}: Props) {
  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="relative z-20 flex w-full flex-col items-center">
        <h2 className="text-[20px] font-light text-ink-900 text-center">
          Your arcana
        </h2>
      </div>

      <div className="relative z-20 flex w-full flex-col items-center">
        <div className="booster-reveal-row flex flex-col items-center justify-center gap-6 sm:flex-row sm:flex-nowrap sm:gap-10 lg:gap-12">
          {boosters.map((cardIdx) => {
            const card = MAJOR_ARCANA[cardIdx];
            if (!card) return null;
            const effect = CARD_EFFECTS[cardIdx] ?? "Slot consumed, −30 score.";
            return (
              <div key={cardIdx} className="booster-reveal-card w-full max-w-[320px] sm:w-auto">
                <div className="booster-reveal-card__art">
                  <CardReveal cardIndex={cardIdx} orientation="upright" />
                </div>
                <div className="booster-reveal-card__info">
                  <p className="booster-reveal-card__title">
                    {card.name}
                  </p>
                  <p className="booster-reveal-card__meaning">
                    {card.meaning}
                  </p>
                  <span className="booster-reveal-card__divider" aria-hidden />
                  <p className="booster-reveal-card__effect-label">Effect</p>
                  <p className="booster-reveal-card__effect-text">
                    {effect}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full max-w-2xl px-4 sm:px-0">
        <EntropyProof
          sequenceNumber={entropySequenceNumber}
          requestTxHash={entropyRequestTxHash}
          callbackTxHash={entropyCallbackTxHash}
        />
      </div>

      <div className="relative z-10 w-full max-w-2xl px-4 sm:px-0">
        <div className="card-surface card-surface-static px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400 text-center">
            The Rites of Consensus: How to Play
          </p>
          <div className="mt-4 rounded-2xl border border-[var(--surface-3)]/80 bg-[var(--surface-2)]/60 px-4 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
              The Objective
            </p>
            <p className="mt-2 text-[12px] text-ink-500 leading-relaxed">
              Face three Oracle Guardians in sequence: Planck, K.tizz, and finally Chop. Your accuracy is your weapon; your speed is your edge. You must defeat all three to finalize your run.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-[var(--surface-3)]/70 bg-[var(--surface-2)]/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                The Combat Protocol
              </p>
              <ul className="mt-2 flex flex-col gap-2.5 text-left text-[12px] text-ink-500 list-none">
                <li>
                  <span className="font-semibold text-ink-500">Data Strike:</span> Every correct answer deals damage to the Guardian.
                </li>
                <li>
                  <span className="font-semibold text-ink-500">Liquidation Risk:</span> Wrong answers deal damage to your vessel. If your HP hits zero, your run is terminated (unless the Judgement Arcana grants an emergency revive).
                </li>
                <li>
                  <span className="font-semibold text-ink-500">Latency Tax (Planck):</span> Speed matters. Correct answers under 10 seconds deal bonus damage. Taking longer than 15 seconds allows the Guardian to &quot;Frontrun&quot; you with passive damage.
                </li>
                <li>
                  <span className="font-semibold text-ink-500">Confidence Gap (Chop):</span> The Final Guardian enters with a Data Shield. You must break through this shield with correct answers before his core HP can be damaged.
                </li>
                <li>
                  <span className="font-semibold text-ink-500">Locked Liquidity (K.tizz):</span> The Tactician will &quot;Freeze&quot; your highest-tier booster. You must bring her HP low enough to unlock the card for use.
                </li>
              </ul>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--surface-3)]/70 bg-[var(--surface-2)]/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                  Consensus Heat & Combos
                </p>
                <p className="mt-2 text-[12px] text-ink-500 leading-relaxed">
                  Every correct answer builds Consensus Heat. When your meter is full, you can unleash a Combo: a high-velocity strike that deducts a massive amount of HP from the Guardian.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--surface-3)]/70 bg-[var(--surface-2)]/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                  Arcana Boosters
                </p>
                <p className="mt-2 text-[12px] text-ink-500 leading-relaxed">
                  You carry a strategic loadout of 3 Major Arcana for the entire run. Open the tray in the duel header to burn a card when you need an edge. Choose your timing wisely! Once a booster is burned, it is gone for the rest of the gauntlet.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--surface-3)]/70 bg-[var(--surface-2)]/40 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
                The Hall of Oracles
              </p>
              <p className="mt-2 text-[12px] text-ink-500 leading-relaxed">
                Finish the full three-Guardian gauntlet to archive your Score and Pyth IQ on the global leaderboard. Compare ranks with the community, share your performance card, and frontrun the competition for the top spot.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ReadingRitualOracleCta
        label="Start Clash"
        ariaLabel="Begin the duel with your drawn boosters"
        onClick={onStart}
        disabled={!canStart}
        glyph={
          <svg className="oracle-button-svg" viewBox="0 0 24 24" aria-hidden>
            <path d="M13 5v14l7-7-7-7zm-8 0v14l7-7-7-7z" />
          </svg>
        }
      />

      {(preparingRun || runStartPending) && (
        <div
          className="flex max-w-md flex-col items-center gap-1.5 px-4 text-center"
          aria-live="polite"
          aria-busy={preparingRun || runStartPending}
        >
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-400">
            <Sparkles
              className={`h-3.5 w-3.5 shrink-0 text-ink-400${preparingRun ? " motion-safe:animate-pulse" : ""}`}
              aria-hidden
            />
            {preparingRun ? "Attuning the spread" : "Crossing the threshold"}
          </p>
          <p className="text-[12px] font-medium leading-relaxed text-ink-500">
            {preparingRun
              ? "Weaving live oracle threads and trial sigils into your deck. Your clash unlocks when the round is inscribed."
              : "Sealing your path into the arena."}
          </p>
        </div>
      )}
    </div>
  );
}

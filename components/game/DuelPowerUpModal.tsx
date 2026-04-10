"use client";

import Image from "next/image";
import { Lock, Rocket, X, Zap } from "lucide-react";
import { MAJOR_ARCANA } from "@/lib/cards";
import { CARD_EFFECTS } from "@/lib/game/card-effects";
import { ReadingOracleNavCta } from "@/components/reading/ReadingWalletHud";

interface Booster {
  majorIndex: number;
  used: boolean;
  locked?: boolean;
}

interface Props {
  boosters: Booster[];
  bossIndex: number;
  /** Server flag: Judgement's one revive per guardian has already fired. */
  judgementUsed?: boolean;
  busy: boolean;
  onUse: (slot: 0 | 1 | 2) => void;
  onClose: () => void;
}

export function DuelPowerUpModal({
  boosters,
  bossIndex,
  judgementUsed = false,
  busy,
  onUse,
  onClose,
}: Props) {
  return (
    <div
      className="duel-booster-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Power-up cards"
    >
      <div className="duel-booster-sheet card-surface border border-[var(--surface-3)]">
        <div className="duel-booster-header">
          <p style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--ink-900)",
            fontFamily: "var(--font-manrope, Manrope)",
            letterSpacing: "-0.01em"
          }}>
            Boosters
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close boosters modal"
            className="duel-booster-close-btn"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="duel-booster-grid">
          {boosters.map((b, slot) => {
            const card = MAJOR_ARCANA[b.majorIndex];
            if (!card) return null;
            const effect = CARD_EFFECTS[b.majorIndex] ?? "Slot consumed, -30 score.";
            const isJudgement = b.majorIndex === 20;
            const isSpent = b.used;
            const isLocked = b.locked && !b.used && bossIndex === 1;
            const canUse = !busy && !isSpent && !isLocked && !isJudgement;

            return (
              <div
                key={slot}
                className={`duel-booster-card ${isSpent ? "duel-booster-card--spent" : ""}`}
              >
                <div className="duel-booster-card__art">
                  {card.image && (
                    <Image
                      src={card.image}
                      alt={card.name}
                      width={180}
                      height={270}
                      className="duel-booster-card__image"
                    />
                  )}
                  {isLocked && (
                    <div className="duel-booster-card__lock-overlay">
                      <Lock size={20} className="duel-booster-card__lock-icon" aria-hidden />
                      <p className="duel-booster-card__lock-heading">Locked</p>
                      <p className="duel-booster-card__lock-copy">
                        Unlocks when boss HP drops below 50%
                      </p>
                    </div>
                  )}
                </div>

                <div className="duel-booster-card__meta">
                  <p className="duel-booster-card__slot">Slot {slot + 1}</p>
                  <p className="duel-booster-card__name">{card.name}</p>
                  <p className="duel-booster-card__effect">{effect}</p>
                </div>

                <div className="duel-booster-card__actions">
                  {isJudgement ? (
                    <div className="duel-booster-card__passive">
                      <Zap size={12} aria-hidden />
                      {judgementUsed
                        ? "Revive already used this guardian (passive spent)"
                        : "Passive: one revive when HP hits 0 (cannot tap)"}
                    </div>
                  ) : isSpent ? (
                    <p className="duel-booster-card__status">Spent</p>
                  ) : isLocked ? (
                    <button
                      type="button"
                      disabled
                      className="duel-booster-card__btn duel-booster-card__btn--locked"
                    >
                      <Lock size={11} aria-hidden />
                      Locked
                    </button>
                  ) : (
                    <ReadingOracleNavCta
                      label="Use"
                      ariaLabel={`Use booster slot ${slot + 1}`}
                      onClick={() => onUse(slot as 0 | 1 | 2)}
                      disabled={!canUse}
                      compact
                      glyph={<Rocket className="oracle-button-svg" size={13} fill="currentColor" stroke="none" aria-hidden />}
                      className="duel-booster-card__oracle-btn"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

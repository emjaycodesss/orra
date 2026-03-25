"use client";

import { MAJOR_ARCANA, type CardOrientation } from "@/lib/cards";

interface Props {
  cardIndex: number;
  orientation: CardOrientation;
}

export function CardReveal({ cardIndex, orientation }: Props) {
  const card = MAJOR_ARCANA[cardIndex];
  if (!card) return null;
  const isReversed = orientation === "reversed";

  return (
    <div className="flex flex-col items-center gap-6 opacity-0 animate-fade-up">
      <div className="animate-card-flip">
        <div className="w-56 h-80 rounded-2xl bg-surface-1 border border-surface-3 shadow-lg flex flex-col items-center justify-center p-6 relative overflow-hidden"
          style={{
            boxShadow: "var(--shadow-3d)",
            transform: isReversed ? "rotate(180deg)" : "none",
          }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.image}
            alt={card.name}
            className="absolute inset-0 w-full h-full object-cover rounded-2xl"
          />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: `radial-gradient(circle at 30% 20%, rgba(124,58,237,0.3), transparent 50%), radial-gradient(circle at 70% 80%, rgba(167,139,250,0.2), transparent 50%)` }} />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-ink-400 mb-3 relative">
            {String(card.index).padStart(2, "0")}
          </span>
          <h3 className="text-[18px] font-semibold text-ink-900 text-center relative">{card.name}</h3>
          <p className="text-[11px] font-medium text-ink-500 mt-2 text-center italic relative">{card.meaning}</p>
          <div className="mt-6 pt-4 border-t border-surface-3 w-full relative">
            <p className="text-[10px] font-medium text-ink-400 text-center leading-relaxed">{card.pythMeaning}</p>
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-ink-500">
          {orientation}
        </p>
        <p className="mt-1 text-[11px] font-medium text-ink-500 italic max-w-xs">
          {isReversed ? card.reversedMeaning : card.meaning}
        </p>
      </div>
    </div>
  );
}

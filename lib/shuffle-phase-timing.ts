export const SHUFFLE_PHASE_CARD_COUNT = 12;
export const SHUFFLE_PHASE_DURATION = 0.8;
export const SHUFFLE_PHASE_Y_OFFSET = 60;
export const SHUFFLE_PHASE_SCALE_OFFSET = 0.02;
export const SHUFFLE_PHASE_SCALE_DURATION = SHUFFLE_PHASE_DURATION / 3;

const STAGGER = SHUFFLE_PHASE_DURATION * 0.03;

export function getShuffleDeckForwardSec(): number {
  const D = SHUFFLE_PHASE_DURATION;
  const n = SHUFFLE_PHASE_CARD_COUNT;
  const shuffleCardsEnd = (n - 1) * STAGGER + D;
  const scaleCardsDuration =
    SHUFFLE_PHASE_SCALE_DURATION * 3;
  const driftOutEnd = 0.55 * scaleCardsDuration + D;
  return Math.max(shuffleCardsEnd, D, scaleCardsDuration, driftOutEnd);
}

export const SHUFFLE_PHASE_VISUAL_CYCLE_SEC = getShuffleDeckForwardSec() * 2;

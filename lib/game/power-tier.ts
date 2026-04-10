/** Major arcana power order: index 0 = strongest tier (product spec section 7). */
const TIER_ORDER = [20, 21, 19, 0, 17, 3, 8, 2, 1, 16, 13, 15, 7, 6, 10, 14, 4, 11, 5, 9, 12, 18] as const;

/** Returns a tier number: higher = more powerful. Unknown cards return 0. */
function getCardPowerTier(majorIndex: number): number {
  const pos = TIER_ORDER.indexOf(majorIndex as (typeof TIER_ORDER)[number]);
  if (pos === -1) return 0;
  return TIER_ORDER.length - pos; // 22 = highest, 1 = lowest in ranked list
}

/** Returns the slot index of the highest-power-tier booster among the given array. */
export function findHighestTierSlot(
  boosters: { majorIndex: number; used: boolean; locked?: boolean }[],
): number {
  let bestSlot = 0;
  let bestTier = -1;
  for (let i = 0; i < boosters.length; i++) {
    const tier = getCardPowerTier(boosters[i]!.majorIndex);
    if (tier > bestTier) {
      bestTier = tier;
      bestSlot = i;
    }
  }
  return bestSlot;
}

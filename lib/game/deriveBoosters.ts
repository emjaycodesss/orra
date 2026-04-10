import { keccak256, concat, toHex, type Hex } from "viem";

/**
 * Derives three unique major arcana indices from on-chain randomness.
 * After the keyed draw, fills from 0..21 so the tuple is always length 3.
 */
export function deriveBoostersFromRandom(randomHex: Hex): [number, number, number] {
  const r = (randomHex.startsWith("0x") ? randomHex : `0x${randomHex}`) as Hex;
  const cards: number[] = [];
  const drawn = new Set<number>();

  for (let i = 0; i < 22 && cards.length < 3; i++) {
    const h = keccak256(concat([r, toHex(i, { size: 1 })]));
    const candidate = Number(BigInt(h) % BigInt(22));

    if (!drawn.has(candidate)) {
      cards.push(candidate);
      drawn.add(candidate);
    }
  }

  for (let candidate = 0; candidate < 22 && cards.length < 3; candidate++) {
    if (!drawn.has(candidate)) {
      cards.push(candidate);
      drawn.add(candidate);
    }
  }

  return [cards[0]!, cards[1]!, cards[2]!];
}

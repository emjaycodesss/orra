import { keccak256, concat, toHex, type Hex } from "viem";

export function deriveBoostersFromRandom(randomHex: Hex): [number, number, number] {
  const r = (randomHex.startsWith("0x") ? randomHex : `0x${randomHex}`) as Hex;
  const out: number[] = [];
  for (let k = 0; k < 3; k++) {
    const h = keccak256(concat([r, toHex(k, { size: 1 })]));
    out.push(Number(BigInt(h) % BigInt(22)));
  }
  return [out[0]!, out[1]!, out[2]!];
}

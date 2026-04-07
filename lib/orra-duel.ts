export const ORRA_DUEL_ABI = [
  {
    type: "function",
    name: "requestSessionBoosters",
    stateMutability: "payable",
    inputs: [{ name: "sessionSalt", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "BoostersDrawn",
    inputs: [
      { name: "sequenceNumber", type: "uint64", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "c0", type: "uint8", indexed: false },
      { name: "c1", type: "uint8", indexed: false },
      { name: "c2", type: "uint8", indexed: false },
      { name: "randomNumber", type: "bytes32", indexed: false },
      { name: "sessionSalt", type: "bytes32", indexed: false },
    ],
  },
] as const;

export function orraDuelAddress(): `0x${string}` | undefined {
  const a = process.env.NEXT_PUBLIC_ORRA_DUEL_CONTRACT_ADDRESS;
  if (!a || !a.startsWith("0x") || a.length !== 42) return undefined;
  return a as `0x${string}`;
}

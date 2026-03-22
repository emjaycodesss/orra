export const ORRA_ABI = [
  {
    inputs: [
      { internalType: "address", name: "entropyAddress", type: "address" },
      { internalType: "address", name: "provider", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint64", name: "sequenceNumber", type: "uint64" },
      { indexed: true, internalType: "address", name: "user", type: "address" },
    ],
    name: "ReadingRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint64", name: "sequenceNumber", type: "uint64" },
      { indexed: true, internalType: "address", name: "user", type: "address" },
      { indexed: false, internalType: "uint8", name: "cardIndex", type: "uint8" },
    ],
    name: "CardDrawn",
    type: "event",
  },
  {
    inputs: [],
    name: "requestReading",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "getFee",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const ORRA_ADDRESS =
  process.env.NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS ?? "";

export const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://mainnet.base.org";

export const ENTROPY_ADDRESS =
  process.env.NEXT_PUBLIC_ENTROPY_ADDRESS ?? "0x6e7d74fa7d5c90fef9f0512987605a6d546181bb";

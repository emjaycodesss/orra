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
      { indexed: false, internalType: "uint32", name: "feedId", type: "uint32" },
      { indexed: false, internalType: "bytes32", name: "oracleSnapshotHash", type: "bytes32" },
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
      { indexed: false, internalType: "uint32", name: "feedId", type: "uint32" },
      { indexed: false, internalType: "bytes32", name: "oracleSnapshotHash", type: "bytes32" },
      { indexed: false, internalType: "bytes32", name: "randomNumber", type: "bytes32" },
    ],
    name: "CardDrawn",
    type: "event",
  },
  {
    inputs: [
      { internalType: "uint32", name: "feedId", type: "uint32" },
      { internalType: "bytes32", name: "oracleSnapshotHash", type: "bytes32" },
    ],
    name: "requestReading",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [],
    name: "entropy",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getFee",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    name: "pendingReadings",
    outputs: [
      { internalType: "address", name: "user", type: "address" },
      { internalType: "uint32", name: "feedId", type: "uint32" },
      { internalType: "bytes32", name: "oracleSnapshotHash", type: "bytes32" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const ORRA_ADDRESS =
  process.env.NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS ?? "";

export const BASE_RPC_URL =
  process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://sepolia.base.org";

export const ENTROPY_ADDRESS =
  process.env.NEXT_PUBLIC_ENTROPY_ADDRESS ??
  "0x41c9e39574F40Ad34c79f1C99B66A45eFB830d4c";

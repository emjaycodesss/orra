import { ethers } from "ethers";
import type { PythStreamData } from "@/lib/oracleState";

export function computeOracleSnapshotHash(data: PythStreamData): string {
  const feedId = data.priceFeedId;
  const priceRaw = BigInt(data.price);
  const confidenceRaw = BigInt(data.confidence);
  const emaConfidenceRaw = BigInt(data.emaConfidence);
  const bestBidRaw = BigInt(data.bestBidPrice || "0");
  const bestAskRaw = BigInt(data.bestAskPrice || "0");
  const exponent = BigInt(data.exponent);
  const publisherCount = data.publisherCount;
  const feedUpdateTimestamp = BigInt(data.feedUpdateTimestamp);

  return ethers.solidityPackedKeccak256(
    [
      "uint32",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "int256",
      "uint32",
      "uint64",
    ],
    [
      feedId,
      priceRaw,
      confidenceRaw,
      emaConfidenceRaw,
      bestBidRaw,
      bestAskRaw,
      exponent,
      publisherCount,
      feedUpdateTimestamp,
    ]
  );
}

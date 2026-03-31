"use client";

import { ethers } from "ethers";
import type { PythStreamData } from "@/lib/oracleState";

interface Props {
  sequenceNumber: bigint | null;
  feedId: number | null;
  feedSymbol?: string | null;
  oracleSnapshotHash: string | null;
  attestedRaw: PythStreamData | null;
}

interface RawSnapshot {
  feedId: number;
  price: string;
  emaPrice: string;
  confidence: string;
  emaConfidence: string;
  bestBidPrice: string;
  bestAskPrice: string;
  exponent: number;
  publisherCount: number;
  feedUpdateTimestamp: number;
}

function readStoredSnapshot(sequenceNumber: bigint): RawSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`reading-${sequenceNumber.toString()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rawSnapshot?: RawSnapshot };
    return parsed.rawSnapshot ?? null;
  } catch {
    return null;
  }
}

function toRawSnapshot(data: PythStreamData): RawSnapshot {
  return {
    feedId: data.priceFeedId,
    price: String(data.price),
    emaPrice: String(data.emaPrice),
    confidence: String(data.confidence),
    emaConfidence: String(data.emaConfidence),
    bestBidPrice: String(data.bestBidPrice ?? "0"),
    bestAskPrice: String(data.bestAskPrice ?? "0"),
    exponent: data.exponent,
    publisherCount: data.publisherCount,
    feedUpdateTimestamp: data.feedUpdateTimestamp,
  };
}

function computeHashFromRawSnapshot(raw: RawSnapshot): string {
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
      raw.feedId,
      BigInt(raw.price),
      BigInt(raw.confidence),
      BigInt(raw.emaConfidence),
      BigInt(raw.bestBidPrice || "0"),
      BigInt(raw.bestAskPrice || "0"),
      BigInt(raw.exponent),
      raw.publisherCount,
      BigInt(raw.feedUpdateTimestamp),
    ]
  );
}

function formatRawWithExponent(raw: string, exponent: number): string {
  const negative = raw.startsWith("-");
  const absDigits = negative ? raw.slice(1) : raw;
  if (exponent >= 0) {
    const whole = `${absDigits}${"0".repeat(exponent)}`;
    return `${negative ? "-" : ""}${whole}`;
  }
  const dec = Math.abs(exponent);
  const padded = absDigits.padStart(dec + 1, "0");
  const split = padded.length - dec;
  const whole = padded.slice(0, split);
  const fraction = padded.slice(split).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function formatUsdFromRaw(raw: string, exponent: number): string {
  const asNumber = Number(raw) * 10 ** exponent;
  if (!Number.isFinite(asNumber)) return formatRawWithExponent(raw, exponent);
  return asNumber.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

function formatCiFromRaw(raw: string, exponent: number): string {
  return `±$${formatUsdFromRaw(raw, exponent)}`;
}

export function ReadingReceipt({
  sequenceNumber,
  feedId,
  feedSymbol,
  oracleSnapshotHash,
  attestedRaw,
}: Props) {
  if (sequenceNumber === null || feedId === null || !oracleSnapshotHash) return null;

  const storedRawSnapshot = readStoredSnapshot(sequenceNumber);

  const rawSnapshot = (() => {
    if (attestedRaw && attestedRaw.priceFeedId === feedId) return toRawSnapshot(attestedRaw);
    if (storedRawSnapshot && storedRawSnapshot.feedId === feedId) return storedRawSnapshot;
    return null;
  })();

  const localHash = rawSnapshot ? computeHashFromRawSnapshot(rawSnapshot) : null;
  const matches =
    localHash !== null &&
    localHash.toLowerCase() === oracleSnapshotHash.toLowerCase();

  return (
    <div className="w-full max-w-2xl mx-auto opacity-0 animate-fade-up">
      <div className="card-surface px-7 py-6 flex flex-col gap-2">
        <p className="mb-2 text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] uppercase text-ink-400">
          on-chain reading receipt
        </p>
        <div className="grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-3 sm:gap-x-8 sm:gap-y-4 sm:text-[14px] font-medium text-ink-600 tabular">
          <p>
            <span className="block text-[10px] font-semibold tracking-[0.16em] uppercase text-ink-400">
              Entropy sequence
            </span>
            <span className="mt-1.5 block text-[20px] sm:text-[22px] font-semibold text-ink-900 leading-none">
              #{sequenceNumber.toString()}
            </span>
          </p>
          <p>
            <span className="block text-[10px] font-semibold tracking-[0.16em] uppercase text-ink-400">
              Pyth feed
            </span>
            <span className="mt-1.5 block text-[17px] sm:text-[18px] font-semibold text-ink-900 leading-tight">
              {feedSymbol ?? "Unknown"}
            </span>
          </p>
          <p>
            <span className="block text-[10px] font-semibold tracking-[0.16em] uppercase text-ink-400">
              Feed ID
            </span>
            <span className="mt-1.5 block text-[17px] sm:text-[18px] font-semibold text-ink-900 leading-tight">
              {feedId}
            </span>
          </p>
          <p className="break-all sm:col-span-3">
            <span className="block text-[10px] font-semibold tracking-[0.16em] uppercase text-ink-400">
              Oracle snapshot hash
            </span>
            <span className="mt-2 block text-[11px] sm:text-[12px] leading-[1.7] tracking-[0.01em] text-ink-800 font-sans tabular">
              {oracleSnapshotHash}
            </span>
          </p>
          {rawSnapshot && (
            <details className="sm:col-span-3">
              <summary className="cursor-pointer text-[11px] sm:text-[12px] font-semibold text-ink-500">
                Show oracle data at draw time
              </summary>
              <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px] sm:text-[12px] text-ink-700 font-sans tabular">
                <span>Feed ID:</span>
                <span>{rawSnapshot.feedId}</span>
                <span>Price:</span>
                <span>
                  {rawSnapshot.price} (exponent {rawSnapshot.exponent} -&gt; $
                  {formatUsdFromRaw(rawSnapshot.price, rawSnapshot.exponent)})
                </span>
                {rawSnapshot.emaPrice && (
                  <>
                    <span>EMA Price:</span>
                    <span>
                      {rawSnapshot.emaPrice} (exponent {rawSnapshot.exponent} -&gt; $
                      {formatUsdFromRaw(rawSnapshot.emaPrice, rawSnapshot.exponent)})
                    </span>
                  </>
                )}
                <span>Confidence:</span>
                <span>
                  {rawSnapshot.confidence} (exponent {rawSnapshot.exponent} -&gt;&nbsp;
                  {formatCiFromRaw(rawSnapshot.confidence, rawSnapshot.exponent)})
                </span>
                <span>EMA Confidence:</span>
                <span>
                  {rawSnapshot.emaConfidence} (exponent {rawSnapshot.exponent} -&gt;&nbsp;
                  {formatCiFromRaw(rawSnapshot.emaConfidence, rawSnapshot.exponent)})
                </span>
                <span>Best Bid:</span>
                <span>
                  {rawSnapshot.bestBidPrice} (exponent {rawSnapshot.exponent} -&gt; $
                  {formatUsdFromRaw(rawSnapshot.bestBidPrice, rawSnapshot.exponent)})
                </span>
                <span>Best Ask:</span>
                <span>
                  {rawSnapshot.bestAskPrice} (exponent {rawSnapshot.exponent} -&gt; $
                  {formatUsdFromRaw(rawSnapshot.bestAskPrice, rawSnapshot.exponent)})
                </span>
                <span>Exponent:</span>
                <span>{rawSnapshot.exponent}</span>
                <span>Publisher Count:</span>
                <span>{rawSnapshot.publisherCount}</span>
                <span>Timestamp:</span>
                <span>{rawSnapshot.feedUpdateTimestamp}</span>
              </div>
            </details>
          )}
          {localHash !== null && (
            <p
              className="text-[11px] sm:text-[12px] pt-1.5 font-semibold leading-relaxed sm:col-span-3"
              style={{ color: matches ? "var(--ink-900)" : "var(--danger)" }}
            >
              {matches
                ? "The oracle's words are sealed."
                : "The oracle's seal does not match this local tick. The hash above is the one bound on-chain at your draw."}
            </p>
          )}
        </div>
        <p className="text-[11px] sm:text-[12px] text-ink-400 leading-[1.75]">
          The market data from your draw is permanently recorded on Base Sepolia. Anyone can verify this
          reading happened exactly as shown - the price, the confidence, the publishers - all
          committed on-chain at the moment you sought the cards.
        </p>
      </div>
    </div>
  );
}

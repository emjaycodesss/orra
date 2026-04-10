"use client";

import { useCallback, useState } from "react";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { keccak256, toHex } from "viem";
import { ORRA_TRIVIA_ABI, orraTriviaAddress } from "@/lib/orra-trivia";
import { deriveBoostersFromRandom } from "@/lib/game/deriveBoosters";
import { humanizeWalletWriteError } from "@/lib/wallet-write-error";

export function useOrraTriviaBoosters() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const triviaAddr = orraTriviaAddress();
  const [pendingSalt, setPendingSalt] = useState<`0x${string}` | null>(null);
  const [receiptConfirmed, setReceiptConfirmed] = useState(false); // TX receipt confirmed, ready to show spread
  const [sequenceNumber, setSequenceNumber] = useState<bigint | null>(null);
  const [requestTxHash, setRequestTxHash] = useState<string | null>(null);
  const [callbackTxHash, setCallbackTxHash] = useState<string | null>(null);
  const [lastBoosters, setLastBoosters] = useState<[number, number, number] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync, isPending } = useWriteContract();

  const requestBoosters = useCallback(async () => {
    setError(null);
    setReceiptConfirmed(false); // Reset receipt state for new request
    setSequenceNumber(null);
    setRequestTxHash(null);
    setCallbackTxHash(null);
    if (!address) {
      setError("Connect wallet");
      return;
    }
    if (!triviaAddr) {
      setError("OrraTrivia contract not configured");
      return;
    }
    const salt = keccak256(toHex(`${Date.now()}-${address}`)) as `0x${string}`;
    setPendingSalt(salt);
    if (!publicClient) {
      setError("No RPC client");
      return;
    }
    let fee: bigint;
    try {
      fee = (await publicClient.readContract({
        address: triviaAddr!,
        abi: ORRA_TRIVIA_ABI,
        functionName: "getFee",
      })) as bigint;
    } catch {
      setError("Could not read trivia fee (wrong network?)");
      setPendingSalt(null);
      return;
    }
    let hash: `0x${string}`;
    try {
      hash = await writeContractAsync({
        address: triviaAddr!,
        abi: ORRA_TRIVIA_ABI,
        functionName: "requestSessionBoosters",
        args: [salt],
        value: fee,
      });
      setRequestTxHash(hash);
    } catch (e) {
      setPendingSalt(null);
      setError(humanizeWalletWriteError(e));
      return;
    }

    let attempts = 0;
    const maxAttempts = 60;
    while (attempts < maxAttempts) {
      try {
        const receipt = await publicClient.getTransactionReceipt({ hash });
        if (receipt) {
          setReceiptConfirmed(true);
          break;
        }
      } catch {}
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }, [address, triviaAddr, publicClient, writeContractAsync]);

  useReactiveEffect(() => {
    if (!triviaAddr || !address || !publicClient || !pendingSalt) return;

    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const unwatch = publicClient.watchContractEvent({
      address: triviaAddr,
      abi: ORRA_TRIVIA_ABI,
      eventName: "BoostersDrawn",
      args: { user: address as `0x${string}` },
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as {
            sequenceNumber?: bigint;
            c0?: number;
            c1?: number;
            c2?: number;
            randomNumber?: `0x${string}`;
            sessionSalt?: `0x${string}`;
          };
          if (args.sessionSalt === pendingSalt && args.randomNumber) {
            if (isMounted) {
              if (args.sequenceNumber !== undefined) {
                setSequenceNumber(args.sequenceNumber);
              }
              if (log.transactionHash) {
                setCallbackTxHash(log.transactionHash as string);
              }
              setLastBoosters(
                deriveBoostersFromRandom(args.randomNumber) as [
                  number,
                  number,
                  number,
                ],
              );
              setPendingSalt(null);
              if (pollInterval) clearInterval(pollInterval);
            }
            break;
          }
        }
      },
    });

    pollInterval = setInterval(async () => {
      if (!isMounted) return;
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const blockWindow = BigInt(128);
        const logs = await publicClient.getLogs({
          address: triviaAddr,
          event: {
            name: "BoostersDrawn",
            type: "event",
            inputs: [
              { name: "sequenceNumber", type: "uint64", indexed: true },
              { name: "user", type: "address", indexed: true },
              { name: "c0", type: "uint8", indexed: false },
              { name: "c1", type: "uint8", indexed: false },
              { name: "c2", type: "uint8", indexed: false },
              { name: "randomNumber", type: "bytes32", indexed: false },
              { name: "sessionSalt", type: "bytes32", indexed: false },
            ],
          } as any,
          args: { user: address as `0x${string}` },
          fromBlock: currentBlock >= blockWindow ? currentBlock - blockWindow : BigInt(0),
        });

        const decodedLogs = logs as Array<{
          args?: {
            sequenceNumber?: bigint;
            c0?: number;
            c1?: number;
            c2?: number;
            randomNumber?: `0x${string}`;
            sessionSalt?: `0x${string}`;
          };
          transactionHash?: `0x${string}`;
        }>;

        for (const log of decodedLogs) {
          if (!isMounted) return;
          const args = log.args;
          if (!args) continue;
          if (args.sessionSalt === pendingSalt && args.randomNumber) {
            if (args.sequenceNumber !== undefined) {
              setSequenceNumber(args.sequenceNumber);
            }
            if (log.transactionHash) {
              setCallbackTxHash(log.transactionHash as string);
            }
            setLastBoosters(
              deriveBoostersFromRandom(args.randomNumber) as [
                number,
                number,
                number,
              ],
            );
            setPendingSalt(null);
            if (pollInterval) clearInterval(pollInterval);
            return;
          }
        }
      } catch {}
    }, 2000);

    return () => {
      isMounted = false;
      unwatch();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [triviaAddr, address, publicClient, pendingSalt]);

  return {
    requestBoosters,
    isPending,
    receiptConfirmed,
    lastBoosters,
    error,
    setLastBoosters,
    sequenceNumber,
    requestTxHash,
    callbackTxHash,
    triviaConfigured: !!triviaAddr,
  };
}

"use client";

import { useCallback, useState } from "react";
import { useReactiveEffect } from "@/hooks/useReactiveEffect";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { keccak256, toHex } from "viem";
import { ORRA_DUEL_ABI, orraDuelAddress } from "@/lib/orra-duel";
import { deriveBoostersFromRandom } from "@/lib/game/deriveBoosters";

export function useOrraDuelBoosters() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const duelAddr = orraDuelAddress();
  const [pendingSalt, setPendingSalt] = useState<`0x${string}` | null>(null);
  const [lastBoosters, setLastBoosters] = useState<[number, number, number] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync, isPending } = useWriteContract();

  const devMock =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ORRA_DUEL_DEV_MOCK === "1";

  const requestBoosters = useCallback(async () => {
    setError(null);
    if (!address) {
      setError("Connect wallet");
      return;
    }
    if (!duelAddr && !devMock) {
      setError("OrraDuel contract not configured");
      return;
    }
    if (devMock) {
      const mockR = keccak256(toHex(`${Date.now()}-${Math.random()}`));
      setLastBoosters(deriveBoostersFromRandom(mockR));
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
        address: duelAddr!,
        abi: ORRA_DUEL_ABI,
        functionName: "getFee",
      })) as bigint;
    } catch {
      setError("Could not read duel fee (wrong network?)");
      setPendingSalt(null);
      return;
    }
    try {
      await writeContractAsync({
        address: duelAddr!,
        abi: ORRA_DUEL_ABI,
        functionName: "requestSessionBoosters",
        args: [salt],
        value: fee,
      });
    } catch (e) {
      setPendingSalt(null);
      setError(e instanceof Error ? e.message : "Transaction failed");
    }
  }, [address, duelAddr, devMock, publicClient, writeContractAsync]);

  useReactiveEffect(() => {
    if (!duelAddr || !address || !publicClient || !pendingSalt) return;
    const unwatch = publicClient.watchContractEvent({
      address: duelAddr,
      abi: ORRA_DUEL_ABI,
      eventName: "BoostersDrawn",
      args: { user: address as `0x${string}` },
      onLogs: (logs) => {
        for (const log of logs) {
          const args = log.args as {
            c0?: number;
            c1?: number;
            c2?: number;
            randomNumber?: `0x${string}`;
            sessionSalt?: `0x${string}`;
          };
          if (args.sessionSalt === pendingSalt && args.randomNumber) {
            setLastBoosters(
              deriveBoostersFromRandom(args.randomNumber) as [
                number,
                number,
                number,
              ],
            );
            setPendingSalt(null);
            break;
          }
        }
      },
    });
    return () => unwatch();
  }, [duelAddr, address, publicClient, pendingSalt]);

  return {
    requestBoosters,
    isPending,
    lastBoosters,
    error,
    setLastBoosters,
    duelConfigured: !!duelAddr || devMock,
  };
}

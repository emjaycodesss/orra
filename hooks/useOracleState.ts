import { useMemo, useRef } from "react";
import {
  computeOracleState,
  type PythStreamData,
  type OracleState,
} from "@/lib/oracleState";

const DEFAULT_ORACLE: OracleState = {
  price: 0,
  emaPrice: 0,
  confidence: 0,
  emaConfidence: 0,
  bid: 0,
  ask: 0,
  confidencePct: 0,
  emaPct: 0,
  signalClarity: "tight",
  confidenceDrift: "stable",
  regime: "neutral",
  momentumPct: 0,
  spreadPct: 0,
  publisherCount: 0,
  marketSession: "closed",
  feedUpdateTimestamp: 0,
  extremeDisagreement: false,
  isStale: true,
  warnings: [],
};

const CONF_EMA_ALPHA = 2 / (20 + 1);

export function useOracleState(raw: PythStreamData | null): OracleState {
  const emaConfTrackerRef = useRef<number | null>(null);
  const prevFeedIdRef = useRef<number | null>(null);

  return useMemo(() => {
    if (!raw) {
      emaConfTrackerRef.current = null;
      prevFeedIdRef.current = null;
      return DEFAULT_ORACLE;
    }

    if (raw.priceFeedId !== prevFeedIdRef.current) {
      emaConfTrackerRef.current = null;
      prevFeedIdRef.current = raw.priceFeedId;
    }

    const confMantissa = Number(raw.confidence ?? 0);
    if (confMantissa > 0) {
      emaConfTrackerRef.current = emaConfTrackerRef.current === null
        ? confMantissa
        : CONF_EMA_ALPHA * confMantissa + (1 - CONF_EMA_ALPHA) * emaConfTrackerRef.current;
    }

    return computeOracleState(raw, emaConfTrackerRef.current);
  }, [raw]);
}

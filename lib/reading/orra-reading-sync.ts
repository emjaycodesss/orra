import { devWarn } from "@/lib/dev-warn";

/**
 * Wire payload for POST `/api/reading/record` (matches chain + optional UI enrichment).
 * See migrations/002_orra_readings.sql and `lib/db/orra-readings.ts`.
 */
type OrraReadingSyncPayload = {
  walletAddress: string;
  chainId: number;
  sequenceNumber: string;
  cardIndex: number;
  isReversed: boolean;
  feedId: number;
  oracleSnapshotHash: string;
  randomNumber: string;
  callbackTxHash: string;
  requestTxHash?: string | null;
  realm?: string | null;
  stance?: string | null;
  timeframe?: string | null;
  truth?: string | null;
  interpretation?: string | null;
  rawSnapshot?: Record<string, unknown> | null;
};

/**
 * Best-effort sync to Postgres (`orra_readings`). No-op if DB is disabled or request fails.
 * Call after `saveOrraReadingRecord` so localStorage remains the offline source of truth.
 */
export function pushOrraReadingToServer(payload: OrraReadingSyncPayload): void {
  void (async () => {
    try {
      const res = await fetch("/api/reading/record", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
        devWarn("orra-reading-sync:http", { status: res.status, ...j });
      }
    } catch (e) {
      devWarn("orra-reading-sync:network", e);
    }
  })();
}

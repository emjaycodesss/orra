import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-observability";
import { upsertOrraReading } from "@/lib/db/orra-readings";
import { isGameDatabaseEnabled } from "@/lib/db/env";
import {
  enforceGameRateLimit,
  jsonApiError,
  normalizeWalletAddress,
  parseJsonBody,
} from "@/lib/game/api-route-helpers";
import { verifyReadingRecordOnChain } from "@/lib/reading/reading-record-verify";

/** Must match the chain where `NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS` is deployed. */
const SUPPORTED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 84532);

type Body = {
  walletAddress?: string;
  chainId?: number;
  sequenceNumber?: string;
  cardIndex?: number;
  isReversed?: boolean;
  feedId?: number;
  oracleSnapshotHash?: string;
  randomNumber?: string;
  callbackTxHash?: string;
  requestTxHash?: string | null;
  realm?: string | null;
  stance?: string | null;
  timeframe?: string | null;
  truth?: string | null;
  interpretation?: string | null;
  /** Extra client fields (asset label, price string, etc.) stored as JSONB. */
  rawSnapshot?: Record<string, unknown> | null;
};

function asTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

/**
 * Persists a verifiable reading row into `orra_readings`.
 * Chain data is checked against `CardDrawn` on the configured Orra contract; enrichment fields are optional.
 */
export async function POST(req: Request) {
  const limited = enforceGameRateLimit(req, {
    route: "reading.record",
    ipMax: 40,
    sessionMax: 80,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (!isGameDatabaseEnabled()) {
    return NextResponse.json({ ok: true, persisted: false, reason: "db_disabled" });
  }

  const parsed = await parseJsonBody<Body>(req);
  if (parsed instanceof NextResponse) return parsed;

  const wallet = normalizeWalletAddress(parsed.walletAddress);
  if (!wallet) return jsonApiError("invalid_wallet", 400);

  const chainId =
    typeof parsed.chainId === "number" && Number.isFinite(parsed.chainId)
      ? Math.floor(parsed.chainId)
      : SUPPORTED_CHAIN_ID;
  if (chainId !== SUPPORTED_CHAIN_ID) {
    return jsonApiError("unsupported_chain", 400);
  }

  const seqStr = asTrimmedString(parsed.sequenceNumber);
  if (!seqStr || !/^\d+$/.test(seqStr)) return jsonApiError("sequence_number", 400);

  const callbackTxHash = asTrimmedString(parsed.callbackTxHash);
  const oracleSnapshotHash = asTrimmedString(parsed.oracleSnapshotHash);
  const randomNumber = asTrimmedString(parsed.randomNumber);
  if (!callbackTxHash || !oracleSnapshotHash || !randomNumber) {
    return jsonApiError("missing_chain_fields", 400);
  }

  if (
    typeof parsed.cardIndex !== "number" ||
    !Number.isInteger(parsed.cardIndex) ||
    typeof parsed.feedId !== "number" ||
    !Number.isInteger(parsed.feedId) ||
    typeof parsed.isReversed !== "boolean"
  ) {
    return jsonApiError("invalid_draw_fields", 400);
  }

  let sequenceNumber: bigint;
  try {
    sequenceNumber = BigInt(seqStr);
  } catch {
    return jsonApiError("sequence_number", 400);
  }

  const verified = await verifyReadingRecordOnChain({
    walletAddress: wallet,
    sequenceNumber,
    cardIndex: parsed.cardIndex,
    feedId: parsed.feedId,
    oracleSnapshotHash,
    randomNumber,
    callbackTxHash,
  });

  if (!verified.ok) {
    return NextResponse.json({ error: "verify_failed", reason: verified.reason }, { status: 400 });
  }

  const id = `${chainId}-${seqStr}`;
  const requestTx = asTrimmedString(parsed.requestTxHash);

  try {
    await upsertOrraReading({
      id,
      chainId,
      walletAddress: wallet,
      sequenceNumber: seqStr,
      cardIndex: parsed.cardIndex,
      isReversed: parsed.isReversed,
      feedId: parsed.feedId,
      oracleSnapshotHash,
      randomNumber,
      blockNumber: verified.meta.blockNumber.toString(),
      blockTimestamp: verified.meta.blockTimestamp,
      callbackTxHash,
      requestTxHash: requestTx,
      realm: asTrimmedString(parsed.realm),
      stance: asTrimmedString(parsed.stance),
      timeframe: asTrimmedString(parsed.timeframe),
      truth: asTrimmedString(parsed.truth),
      interpretation:
        typeof parsed.interpretation === "string" && parsed.interpretation.trim()
          ? parsed.interpretation.trim()
          : null,
      rawSnapshot:
        parsed.rawSnapshot && typeof parsed.rawSnapshot === "object" && !Array.isArray(parsed.rawSnapshot)
          ? parsed.rawSnapshot
          : null,
    });
    return NextResponse.json({ ok: true, persisted: true });
  } catch (err) {
    logApiError("api/reading/record", err, { wallet, chainId, seq: seqStr });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

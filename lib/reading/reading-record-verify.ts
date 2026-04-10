import { ethers } from "ethers";
import { ORRA_ABI, ORRA_ADDRESS, BASE_RPC_URL } from "@/lib/contract";

/** Normalize bytes32 / hex strings for comparison. */
function normHex(h: string): string {
  const s = h.trim();
  const with0x = s.startsWith("0x") ? s : `0x${s}`;
  return with0x.toLowerCase();
}

type VerifiedReadingMeta = {
  blockNumber: bigint;
  blockTimestamp: Date | null;
};

/**
 * Confirms `callbackTxHash` is a successful Orra `CardDrawn` for this wallet/sequence
 * and that payload fields match the log (prevents forging rows in `orra_readings`).
 */
export async function verifyReadingRecordOnChain(params: {
  walletAddress: string;
  sequenceNumber: bigint;
  cardIndex: number;
  feedId: number;
  oracleSnapshotHash: string;
  randomNumber: string;
  callbackTxHash: string;
}): Promise<{ ok: true; meta: VerifiedReadingMeta } | { ok: false; reason: string }> {
  if (!ORRA_ADDRESS?.trim()) {
    return { ok: false, reason: "contract_not_configured" };
  }

  const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  const contract = new ethers.Contract(ORRA_ADDRESS, ORRA_ABI, provider);
  const iface = contract.interface;

  let receipt: ethers.TransactionReceipt | null;
  try {
    receipt = await provider.getTransactionReceipt(params.callbackTxHash);
  } catch {
    return { ok: false, reason: "receipt_fetch_failed" };
  }

  if (!receipt || receipt.status !== 1) {
    return { ok: false, reason: "invalid_or_pending_receipt" };
  }

  const wantUser = params.walletAddress.toLowerCase();
  const wantSeq = params.sequenceNumber;
  const wantCard = params.cardIndex;
  const wantFeed = params.feedId;
  const wantOracle = normHex(params.oracleSnapshotHash);
  const wantRand = normHex(params.randomNumber);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ORRA_ADDRESS.toLowerCase()) continue;
    let parsed: ethers.LogDescription | null = null;
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue;
    }
    if (!parsed || parsed.name !== "CardDrawn") continue;

    const seq = parsed.args.sequenceNumber as bigint;
    const user = (parsed.args.user as string).toLowerCase();
    const cardIndex = Number(parsed.args.cardIndex as bigint | number);
    const feedId = Number(parsed.args.feedId as bigint | number);
    const oracleSnapshotHash = normHex(String(parsed.args.oracleSnapshotHash));
    const randomNumber = normHex(String(parsed.args.randomNumber));

    if (seq !== wantSeq || user !== wantUser) continue;
    if (cardIndex !== wantCard || feedId !== wantFeed) continue;
    if (oracleSnapshotHash !== wantOracle || randomNumber !== wantRand) {
      return { ok: false, reason: "payload_mismatch" };
    }

    let blockTimestamp: Date | null = null;
    try {
      const block = await provider.getBlock(receipt.blockNumber);
      if (block?.timestamp != null) {
        blockTimestamp = new Date(Number(block.timestamp) * 1000);
      }
    } catch {
      /* non-fatal */
    }

    return {
      ok: true,
      meta: {
        blockNumber: BigInt(receipt.blockNumber),
        blockTimestamp,
      },
    };
  }

  return { ok: false, reason: "card_drawn_log_not_found" };
}

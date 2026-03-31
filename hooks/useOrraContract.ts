import { useSyncExternalStore, useCallback } from "react";
import { ethers } from "ethers";
import { ORRA_ABI, ORRA_ADDRESS, BASE_RPC_URL } from "@/lib/contract";
import { readOrraFee } from "@/lib/orra-fee";
import { deriveIsReversed } from "@/lib/cards";

type Listener = () => void;

export interface OnChainReading {
  cardIndex: number;
  sequenceNumber: bigint;
  feedId: number;
  oracleSnapshotHash: string;
  randomNumber: string;
  isReversed: boolean;
  callbackTxHash: string;
}

interface ReadingState {
  status: "idle" | "requesting" | "waiting" | "revealed" | "error" | "timeout";
  cardIndex: number | null;
  sequenceNumber: bigint | null;
  requestBlockNumber: bigint | null;
  requester: string | null;
  requestTxHash: string | null;
  callbackTxHash: string | null;
  feedId: number | null;
  oracleSnapshotHash: string | null;
  randomNumber: string | null;
  isReversed: boolean | null;
  error: string | null;
  fee: bigint | null;
}

function toHumanReadingError(error: unknown): { message: string; isTimeout: boolean } {
  const asAny = error as {
    code?: number | string;
    shortMessage?: string;
    reason?: string;
    message?: string;
    info?: { error?: { code?: number | string; message?: string } };
  };
  const message = error instanceof Error ? error.message : String(error);
  const shortMessage = asAny?.shortMessage ?? "";
  const reason = asAny?.reason ?? "";
  const nestedCode = asAny?.info?.error?.code;
  const code = asAny?.code;
  const joined = `${message} ${shortMessage} ${reason}`.toLowerCase();

  if (
    code === "ACTION_REJECTED" ||
    code === 4001 ||
    nestedCode === 4001 ||
    joined.includes("user rejected") ||
    joined.includes("ethers-user-denied")
  ) {
    return {
      message: "Transaction cancelled. No worries - your wallet rejected the request, so nothing was sent.",
      isTimeout: false,
    };
  }

  if (joined.includes("timeout")) {
    return { message, isTimeout: true };
  }

  return { message, isTimeout: false };
}

class OrraContractStore {
  private state: ReadingState = {
    status: "idle",
    cardIndex: null,
    sequenceNumber: null,
    requestBlockNumber: null,
    requester: null,
    requestTxHash: null,
    callbackTxHash: null,
    feedId: null,
    oracleSnapshotHash: null,
    randomNumber: null,
    isReversed: null,
    error: null,
    fee: null,
  };
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.state;
  getServerSnapshot = () => this.state;

  private update(partial: Partial<ReadingState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  private async waitForCardDrawnBySequence(
    readContract: ethers.Contract,
    sequenceNumber: bigint,
    user: string,
    fromBlock: bigint,
    timeoutMs: number
  ): Promise<OnChainReading> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const filter = readContract.filters.CardDrawn(sequenceNumber, user);
      const logs = (await readContract.queryFilter(
        filter,
        fromBlock,
        "latest"
      )) as ethers.EventLog[];
      const latest = logs.at(-1);
      if (latest) {
        const args = latest.args as unknown as {
          sequenceNumber: bigint;
          user: string;
          cardIndex: bigint | number;
          feedId: bigint;
          oracleSnapshotHash: string;
          randomNumber: string;
        };
        const cardIndexNum = Number(args.cardIndex);
        return {
          cardIndex: cardIndexNum,
          sequenceNumber: args.sequenceNumber,
          feedId: Number(args.feedId),
          oracleSnapshotHash: args.oracleSnapshotHash,
          randomNumber: args.randomNumber,
          isReversed: deriveIsReversed(args.randomNumber),
          callbackTxHash: latest.transactionHash,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error("Timeout waiting for card draw");
  }

  async fetchFee() {
    if (!ORRA_ADDRESS) {
      this.update({
        error:
          "Orra contract address is not configured (NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS).",
      });
      return;
    }
    try {
      const fee = await readOrraFee();
      this.update({ fee, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.update({ error: `Fee fetch failed: ${msg}` });
    }
  }

  async requestReading(
    signer: ethers.Signer,
    feedId: number,
    oracleSnapshotHash: string
  ) {
    this.update({
      status: "requesting",
      cardIndex: null,
      sequenceNumber: null,
      requestBlockNumber: null,
      requester: null,
      requestTxHash: null,
      callbackTxHash: null,
      feedId: null,
      oracleSnapshotHash: null,
      randomNumber: null,
      isReversed: null,
      error: null,
    });

    try {
      const contract = new ethers.Contract(ORRA_ADDRESS, ORRA_ABI, signer);
      const fee = this.state.fee ?? (await readOrraFee());
      const tx = await contract.requestReading(feedId, oracleSnapshotHash, {
        value: fee,
      });
      this.update({ status: "waiting" });

      const receipt = await tx.wait();

      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const readContract = new ethers.Contract(ORRA_ADDRESS, ORRA_ABI, provider);
      const signerAddress = receipt.from;
      const requestLog = receipt.logs.find((log: ethers.Log) => {
        try {
          const parsed = readContract.interface.parseLog(log);
          return parsed?.name === "ReadingRequested";
        } catch {
          return false;
        }
      });
      if (!requestLog) throw new Error("ReadingRequested event missing from transaction receipt");
      const parsedRequest = readContract.interface.parseLog(requestLog);
      if (!parsedRequest || parsedRequest.name !== "ReadingRequested") {
        throw new Error("Could not parse ReadingRequested event");
      }
      const sequenceNumber = parsedRequest.args.sequenceNumber as bigint;
      const requestBlockNumber = BigInt(receipt.blockNumber);
      this.update({
        status: "waiting",
        sequenceNumber,
        requestBlockNumber,
        requester: signerAddress,
        requestTxHash: tx.hash,
        callbackTxHash: null,
        feedId,
        oracleSnapshotHash,
        error: null,
      });

      const result = await this.waitForCardDrawnBySequence(
        readContract,
        sequenceNumber,
        signerAddress,
        requestBlockNumber,
        120000
      );
      this.update({
        status: "revealed",
        cardIndex: result.cardIndex,
        sequenceNumber: result.sequenceNumber,
        requestBlockNumber,
        requester: signerAddress,
        requestTxHash: tx.hash,
        callbackTxHash: result.callbackTxHash,
        feedId: result.feedId,
        oracleSnapshotHash: result.oracleSnapshotHash,
        randomNumber: result.randomNumber,
        isReversed: result.isReversed,
        error: null,
      });
    } catch (e) {
      const normalized = toHumanReadingError(e);
      if (normalized.isTimeout) {
        this.update({
          status: "timeout",
          error:
            "The draw is still pending on-chain. Entropy can take longer than expected. You can continue waiting without sending a new transaction.",
        });
      } else {
        this.update({ status: "error", error: normalized.message });
      }
    }
  }

  async resumePendingReading() {
    const { sequenceNumber, requester, requestBlockNumber } = this.state;
    if (!sequenceNumber || !requester || !requestBlockNumber) {
      this.update({
        status: "error",
        error: "No pending draw found. Start a new draw request.",
      });
      return;
    }
    this.update({
      status: "waiting",
      error: null,
    });
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const readContract = new ethers.Contract(ORRA_ADDRESS, ORRA_ABI, provider);
      const result = await this.waitForCardDrawnBySequence(
        readContract,
        sequenceNumber,
        requester,
        requestBlockNumber,
        120000
      );
      this.update({
        status: "revealed",
        cardIndex: result.cardIndex,
        sequenceNumber: result.sequenceNumber,
        requestBlockNumber,
        requester,
        callbackTxHash: result.callbackTxHash,
        feedId: result.feedId,
        oracleSnapshotHash: result.oracleSnapshotHash,
        randomNumber: result.randomNumber,
        isReversed: result.isReversed,
        error: null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes("timeout")) {
        this.update({
          status: "timeout",
          error:
            "Still waiting for Entropy reveal. No new transaction was sent.",
        });
      } else {
        this.update({
          status: "error",
          error: `Could not resume pending draw: ${msg}`,
        });
      }
    }
  }

  reset() {
    this.state = {
      status: "idle",
      cardIndex: null,
      sequenceNumber: null,
      requestBlockNumber: null,
      requester: null,
      requestTxHash: null,
      callbackTxHash: null,
      feedId: null,
      oracleSnapshotHash: null,
      randomNumber: null,
      isReversed: null,
      error: null,
      fee: null,
    };
    this.notify();
  }
}

const store = new OrraContractStore();

export function useOrraContract() {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );

  const fetchFee = useCallback(() => store.fetchFee(), []);
  const requestReading = useCallback(
    (signer: ethers.Signer, feedId: number, oracleSnapshotHash: string) =>
      store.requestReading(signer, feedId, oracleSnapshotHash),
    []
  );
  const resumePendingReading = useCallback(() => store.resumePendingReading(), []);
  const reset = useCallback(() => store.reset(), []);

  return { ...state, fetchFee, requestReading, resumePendingReading, reset };
}

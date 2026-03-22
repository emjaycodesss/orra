import { useSyncExternalStore, useCallback } from "react";
import { ethers } from "ethers";
import { ORRA_ABI, ORRA_ADDRESS, BASE_RPC_URL } from "@/lib/contract";

type Listener = () => void;

interface ReadingState {
  status: "idle" | "requesting" | "waiting" | "revealed" | "error" | "timeout";
  cardIndex: number | null;
  sequenceNumber: bigint | null;
  error: string | null;
  fee: bigint | null;
}

class OrraContractStore {
  private state: ReadingState = {
    status: "idle",
    cardIndex: null,
    sequenceNumber: null,
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

  async fetchFee() {
    try {
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const contract = new ethers.Contract(ORRA_ADDRESS, ORRA_ABI, provider);
      const fee = await contract.getFee();
      this.update({ fee: BigInt(fee.toString()) });
    } catch (e) {
      this.update({ error: `Fee fetch failed: ${e}` });
    }
  }

  async requestReading(signer: ethers.Signer) {
    this.update({
      status: "requesting",
      cardIndex: null,
      sequenceNumber: null,
      error: null,
    });

    try {
      const contract = new ethers.Contract(ORRA_ADDRESS, ORRA_ABI, signer);
      const fee = this.state.fee ?? await contract.getFee();
      const tx = await contract.requestReading({ value: fee });
      this.update({ status: "waiting" });

      const receipt = await tx.wait();

      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const readContract = new ethers.Contract(ORRA_ADDRESS, ORRA_ABI, provider);

      const cardDrawnPromise = new Promise<{ cardIndex: number; sequenceNumber: bigint }>(
        (resolve, reject) => {
          const timeout = setTimeout(() => {
            readContract.removeAllListeners("CardDrawn");
            reject(new Error("Timeout waiting for card draw"));
          }, 30000);

          const signerAddress = receipt.from;
          readContract.on(
            "CardDrawn",
            (seqNum: bigint, user: string, cardIdx: number) => {
              if (user.toLowerCase() === signerAddress.toLowerCase()) {
                clearTimeout(timeout);
                readContract.removeAllListeners("CardDrawn");
                resolve({
                  cardIndex: Number(cardIdx),
                  sequenceNumber: seqNum,
                });
              }
            }
          );
        }
      );

      const result = await cardDrawnPromise;
      this.update({
        status: "revealed",
        cardIndex: result.cardIndex,
        sequenceNumber: result.sequenceNumber,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Timeout")) {
        this.update({ status: "timeout", error: msg });
      } else {
        this.update({ status: "error", error: msg });
      }
    }
  }

  reset() {
    this.state = {
      status: "idle",
      cardIndex: null,
      sequenceNumber: null,
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
    (signer: ethers.Signer) => store.requestReading(signer),
    []
  );
  const reset = useCallback(() => store.reset(), []);

  return { ...state, fetchFee, requestReading, reset };
}

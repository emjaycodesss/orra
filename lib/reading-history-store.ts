import { ethers } from "ethers";
import { ORRA_ABI, ORRA_ADDRESS, BASE_RPC_URL } from "@/lib/contract";
import { deriveIsReversed } from "@/lib/cards";

export interface PastReading {
  key: string;
  sequenceNumber: bigint;
  cardIndex: number;
  feedId: number;
  oracleSnapshotHash: string;
  randomNumber: string;
  blockNumber: number;
  blockTimestamp: number | null;
  txHash: string;
  isReversed: boolean;
}

type StoreState = {
  status: "idle" | "loading" | "ready" | "error";
    byAddress: string;
  items: PastReading[];
  error: string | null;
};

const initial: StoreState = {
  status: "idle",
  byAddress: "",
  items: [],
  error: null,
};

let state: StoreState = initial;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribePastReadings(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getPastReadingsSnapshot(): StoreState {
  return state;
}

export function getPastReadingsServerSnapshot(): StoreState {
  return initial;
}

const LOG_BLOCK_CHUNK = BigInt(9_800);
const CHUNK_CONCURRENCY = 8;
const TIMESTAMP_FETCH_CONCURRENCY = 32;

const DEFAULT_LOG_LOOKBACK_BLOCKS = BigInt(2_000_000);

let loadGeneration = 0;
let cachedDeployBlock: bigint | null = null;

async function mapPool<T, R>(items: T[], poolSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  };
  const n = Math.min(poolSize, items.length);
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

async function queryCardDrawnLogsChunked(
  contract: ethers.Contract,
  filter: Parameters<ethers.Contract["queryFilter"]>[0],
  fromBlock: bigint,
  toBlock: bigint
): Promise<ethers.Log[]> {
  const end = toBlock;
  const one = BigInt(1);

  if (end - fromBlock <= LOG_BLOCK_CHUNK) {
    return contract.queryFilter(filter, fromBlock, end);
  }

  const ranges: Array<[bigint, bigint]> = [];
  let start = fromBlock;
  while (start <= end) {
    const chunkEnd = start + LOG_BLOCK_CHUNK > end ? end : start + LOG_BLOCK_CHUNK;
    ranges.push([start, chunkEnd]);
    start = chunkEnd + one;
  }

  const out: ethers.Log[] = [];
  for (let i = 0; i < ranges.length; i += CHUNK_CONCURRENCY) {
    const batch = ranges.slice(i, i + CHUNK_CONCURRENCY);
    const results = await Promise.all(
      batch.map(([from, to]) => contract.queryFilter(filter, from, to))
    );
    for (const chunk of results) out.push(...chunk);
  }
  return out;
}

async function findContractDeployBlock(
  provider: ethers.JsonRpcProvider,
  contractAddress: string,
  latestBlock: bigint
): Promise<bigint> {
  const latestCode = await provider.getCode(contractAddress, Number(latestBlock));
  if (!latestCode || latestCode === "0x") return BigInt(0);

  let lo = BigInt(0);
  let hi = latestBlock;
  while (lo < hi) {
    const mid = (lo + hi) / BigInt(2);
    const codeAtMid = await provider.getCode(contractAddress, Number(mid));
    if (codeAtMid && codeAtMid !== "0x") {
      hi = mid;
    } else {
      lo = mid + BigInt(1);
    }
  }
  return lo;
}

async function resolveFromBlock(
  provider: ethers.JsonRpcProvider,
  latestBlock: bigint
): Promise<bigint> {
  const deployBlockEnv = BigInt(
    Math.max(0, Number(process.env.NEXT_PUBLIC_ORRA_DEPLOY_BLOCK ?? 0))
  );
  if (deployBlockEnv > BigInt(0)) return deployBlockEnv;

  if (cachedDeployBlock !== null) return cachedDeployBlock;

  try {
    cachedDeployBlock = await findContractDeployBlock(provider, ORRA_ADDRESS, latestBlock);
    return cachedDeployBlock;
  } catch {
    return latestBlock > DEFAULT_LOG_LOOKBACK_BLOCKS
      ? latestBlock - DEFAULT_LOG_LOOKBACK_BLOCKS
      : BigInt(0);
  }
}

export async function loadPastReadingsForAddress(
  address: string,
  options?: { force?: boolean }
) {
  const key = address.toLowerCase();
  if (!ORRA_ADDRESS) {
    state = {
      status: "error",
      byAddress: key,
      items: [],
      error: "Orra contract is not configured (NEXT_PUBLIC_ORRA_CONTRACT_ADDRESS).",
    };
    emit();
    return;
  }

  if (!options?.force && state.byAddress === key && state.status === "ready") return;
  if (!options?.force && state.byAddress === key && state.status === "loading") return;

  const myGen = ++loadGeneration;
  state = { status: "loading", byAddress: key, items: [], error: null };
  emit();

  try {
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const contract = new ethers.Contract(ORRA_ADDRESS, ORRA_ABI, provider);
    const filter = contract.filters.CardDrawn(null, address);
    const latestBn = await provider.getBlockNumber();
    const latest = BigInt(latestBn);
    const fromBlock = await resolveFromBlock(provider, latest);
    const logs = await queryCardDrawnLogsChunked(contract, filter, fromBlock, latest);

    const uniqueBlockNumbers = [...new Set(logs.map((l) => Number(l.blockNumber)))];
    const blockTimestampPairs = await mapPool(uniqueBlockNumbers, TIMESTAMP_FETCH_CONCURRENCY, (bn) =>
      provider.getBlock(bn).then((b) => [bn, b?.timestamp ?? null] as [number, number | null])
    );
    const blockTs = new Map<number, number | null>(blockTimestampPairs);

    const items: PastReading[] = [];

    for (const log of logs) {
      const ev = log as ethers.EventLog;
      if (ev.args == null) continue;
      if (ev.fragment?.name !== "CardDrawn") continue;
      const a = ev.args as unknown as {
        sequenceNumber: bigint;
        cardIndex: bigint | number;
        feedId: bigint | number;
        oracleSnapshotHash: string;
        randomNumber: string;
      };
      const sequenceNumber = a.sequenceNumber;
      const cardIndex = Number(a.cardIndex);
      const feedId = Number(a.feedId);
      const oracleSnapshotHash = String(a.oracleSnapshotHash);
      const randomNumber = String(a.randomNumber);
      const bn = Number(log.blockNumber);

      items.push({
        key: `${log.transactionHash}-${log.index}`,
        sequenceNumber,
        cardIndex,
        feedId,
        oracleSnapshotHash,
        randomNumber,
        blockNumber: bn,
        blockTimestamp: blockTs.get(bn) ?? null,
        txHash: log.transactionHash,
        isReversed: deriveIsReversed(randomNumber),
      });
    }

    items.sort((x, y) => {
      if (y.blockNumber !== x.blockNumber) return y.blockNumber - x.blockNumber;
      if (y.sequenceNumber !== x.sequenceNumber)
        return y.sequenceNumber > x.sequenceNumber ? 1 : -1;
      return 0;
    });

    if (myGen !== loadGeneration) return;
    state = { status: "ready", byAddress: key, items, error: null };
  } catch (e) {
    if (myGen !== loadGeneration) return;
    state = {
      status: "error",
      byAddress: key,
      items: [],
      error:
        e instanceof Error ? e.message : "Could not load readings from the network.",
    };
  }
  emit();
}

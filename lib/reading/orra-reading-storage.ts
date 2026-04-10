import { devWarn } from "@/lib/dev-warn";

const ORRA_READING_STORAGE_PREFIX = "orra-reading-";

const MAX_ORRA_READING_RECORDS = 22;

type OrraReadingRecord = {
  cardIndex: number;
  isReversed: boolean;
  asset: string;
  assetSymbol: string;
  price: string;
  interpretation: string;
  timestamp: number;
  sequenceNumber: string;
  txHash: string;
  oracleSnapshotHash: string;
  requestTxHash?: string;
};

function orraReadingStorageKey(sequenceNumber: bigint | string): string {
  const s = typeof sequenceNumber === "bigint" ? sequenceNumber.toString() : sequenceNumber;
  return `${ORRA_READING_STORAGE_PREFIX}${s}`;
}

function parseRecord(raw: string): OrraReadingRecord | null {
  try {
    const o = JSON.parse(raw) as OrraReadingRecord;
    if (
      typeof o.sequenceNumber === "string" &&
      typeof o.interpretation === "string" &&
      typeof o.timestamp === "number"
    ) {
      return o;
    }
  } catch (e) {
    devWarn("orra-reading:parse-record", e);
  }
  return null;
}

export function readOrraReadingRecord(sequenceNumber: bigint): OrraReadingRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(orraReadingStorageKey(sequenceNumber));
    if (!raw) return null;
    return parseRecord(raw);
  } catch (e) {
    devWarn("orra-reading:read", e);
    return null;
  }
}

export function formatPriceForOrraRecord(raw: { price: string; exponent: number }): string {
  const n = Number(raw.price) * 10 ** raw.exponent;
  if (!Number.isFinite(n)) return raw.price;
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function saveOrraReadingRecord(record: OrraReadingRecord): void {
  if (typeof window === "undefined") return;
  try {
    const key = orraReadingStorageKey(record.sequenceNumber);
    window.localStorage.setItem(key, JSON.stringify(record));
    pruneOrraReadingRecords();
  } catch (e) {
    devWarn("orra-reading:save", e);
  }
}

function pruneOrraReadingRecords(): void {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k?.startsWith(ORRA_READING_STORAGE_PREFIX)) keys.push(k);
  }
  if (keys.length <= MAX_ORRA_READING_RECORDS) return;

  const scored: { key: string; ts: number }[] = [];
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const rec = parseRecord(raw);
    scored.push({ key, ts: rec?.timestamp ?? 0 });
  }
  scored.sort((a, b) => a.ts - b.ts);
  const overflow = scored.length - MAX_ORRA_READING_RECORDS;
  for (let i = 0; i < overflow; i++) {
    window.localStorage.removeItem(scored[i].key);
  }
}

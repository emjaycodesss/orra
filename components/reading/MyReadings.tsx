"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import { useAccount, useChainId } from "wagmi";
import { MAJOR_ARCANA, type CardOrientation } from "@/lib/cards";
import {
  getPastReadingsServerSnapshot,
  getPastReadingsSnapshot,
  loadPastReadingsForAddress,
  subscribePastReadings,
  type PastReading,
} from "@/lib/reading/reading-history-store";
import {
  formatPriceForOrraRecord,
  readOrraReadingRecord,
  saveOrraReadingRecord,
} from "@/lib/reading/orra-reading-storage";
import { pushOrraReadingToServer } from "@/lib/reading/orra-reading-sync";
import { CardReveal } from "@/components/reading/CardReveal";
import { EntropyProof } from "@/components/reading/EntropyProof";
import { Interpretation } from "@/components/reading/Interpretation";
import { ReadingReceipt } from "@/components/reading/ReadingReceipt";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import { ReadingConnectInline } from "@/components/reading/ReadingWalletHud";
import { downloadReadingAsPng } from "@/lib/reading/export-reading-png";
import { devWarn } from "@/lib/dev-warn";

function MyReadingsChainLoading() {
  return (
    <div
      className="reading-history-loading-hero my-readings"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="reading-approach-logo-shell w-full max-w-[min(280px,72vw)] shrink-0">
        <ReadingApproachLogoLoader />
      </div>
      <p className="max-w-[min(36rem,calc(100vw-2.5rem))] text-balance px-2 font-sans text-[15px] font-light leading-relaxed text-ink-500 sm:text-[17px] sm:leading-relaxed md:text-[19px]">
        Gathering your readings from the chain…
      </p>
    </div>
  );
}

function formatTime(ts: number | null) {
  if (ts == null) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts * 1000));
  } catch (e) {
    devWarn("my-readings:format-time", e);
    return "—";
  }
}

const PAST_READING_NO_INTERP =
  "Interpretation text is not stored in historical on-chain events yet. Draw a new reading to generate a full oracle interpretation.";

function readStoredInterpretation(sequenceNumber: bigint): string | null {
  if (typeof window === "undefined") return null;
  const orra = readOrraReadingRecord(sequenceNumber);
  if (orra?.interpretation?.trim()) return orra.interpretation;
  try {
    const raw = window.localStorage.getItem(`reading-${sequenceNumber.toString()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { interpretation?: string };
    return parsed.interpretation ?? null;
  } catch (e) {
    devWarn("my-readings:stored-interpretation", e);
    return null;
  }
}

function compactOracleFeedSymbol(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const hasSpaces = /\s/.test(t);
  if (hasSpaces) return t;

  if (t.includes(".")) {
    const tail = t.slice(t.lastIndexOf(".") + 1);
    if (tail.includes("/")) {
      return tail.replace(/\//g, "").replace(/-/g, "").toUpperCase();
    }
    if (/^[A-Za-z0-9-]+$/.test(tail) && tail.length <= 16) {
      return tail.toUpperCase();
    }
  }

  if (t.includes("/") && t.length <= 32) {
    return t.replace(/\//g, "").replace(/-/g, "").toUpperCase();
  }

  return t;
}

function readPastReadingFeedSymbol(sequenceNumber: bigint): string | null {
  if (typeof window === "undefined") return null;
  const orra = readOrraReadingRecord(sequenceNumber);
  if (orra?.asset?.trim()) return orra.asset.trim();
  if (orra?.assetSymbol?.trim()) return compactOracleFeedSymbol(orra.assetSymbol);
  try {
    const raw = window.localStorage.getItem(`reading-${sequenceNumber.toString()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { realm?: string; realmSymbol?: string };
    if (typeof parsed.realm === "string" && parsed.realm.trim()) return parsed.realm.trim();
    if (typeof parsed.realmSymbol === "string" && parsed.realmSymbol.trim()) {
      return compactOracleFeedSymbol(parsed.realmSymbol);
    }
    return null;
  } catch (e) {
    devWarn("my-readings:past-feed-symbol", e);
    return null;
  }
}

function readPastReadingListAssetLabel(sequenceNumber: bigint): string | null {
  if (typeof window === "undefined") return null;
  const orra = readOrraReadingRecord(sequenceNumber);
  if (orra?.asset?.trim()) return orra.asset.trim();
  if (orra?.assetSymbol?.trim()) return compactOracleFeedSymbol(orra.assetSymbol);
  try {
    const raw = window.localStorage.getItem(`reading-${sequenceNumber.toString()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { realm?: string; realmSymbol?: string };
    if (typeof parsed.realm === "string" && parsed.realm.trim()) {
      return parsed.realm.trim();
    }
    if (typeof parsed.realmSymbol === "string" && parsed.realmSymbol.trim()) {
      return compactOracleFeedSymbol(parsed.realmSymbol);
    }
    return null;
  } catch (e) {
    devWarn("my-readings:past-list-asset", e);
    return null;
  }
}

function persistPastReadingOrraRecord(
  reading: PastReading,
  interpretation: string,
  ctx: { walletAddress: string; chainId: number }
) {
  let asset = `Feed #${reading.feedId}`;
  let assetSymbol = "";
  let price = "—";
  let requestTxHash = "";
  let realm: string | undefined;
  let stance: string | undefined;
  let timeframe: string | undefined;
  let truth: string | undefined;
  try {
    const legacy = window.localStorage.getItem(`reading-${reading.sequenceNumber.toString()}`);
    if (legacy) {
      const p = JSON.parse(legacy) as {
        rawSnapshot?: { price: string; exponent: number };
        realm?: string;
        realmSymbol?: string;
        requestTxHash?: string | null;
        stance?: string;
        timeframe?: string;
        truth?: string;
      };
      if (p.rawSnapshot) price = formatPriceForOrraRecord(p.rawSnapshot);
      if (typeof p.realm === "string" && p.realm.trim()) {
        asset = p.realm;
        realm = p.realm.trim();
      }
      if (typeof p.realmSymbol === "string") assetSymbol = p.realmSymbol;
      if (typeof p.requestTxHash === "string" && p.requestTxHash.trim()) {
        requestTxHash = p.requestTxHash.trim();
      }
      if (typeof p.stance === "string" && p.stance.trim()) stance = p.stance.trim();
      if (typeof p.timeframe === "string" && p.timeframe.trim()) timeframe = p.timeframe.trim();
      if (typeof p.truth === "string" && p.truth.trim()) truth = p.truth.trim();
    }
  } catch (e) {
    devWarn("my-readings:persist-legacy", e);
  }
  saveOrraReadingRecord({
    cardIndex: reading.cardIndex,
    isReversed: reading.isReversed,
    asset,
    assetSymbol,
    price,
    interpretation,
    timestamp: Date.now(),
    sequenceNumber: reading.sequenceNumber.toString(),
    txHash: reading.txHash,
    oracleSnapshotHash: reading.oracleSnapshotHash,
    ...(requestTxHash ? { requestTxHash } : {}),
  });
  const cb = reading.txHash?.trim();
  if (
    ctx.walletAddress &&
    cb &&
    reading.randomNumber &&
    Number.isFinite(reading.feedId)
  ) {
    pushOrraReadingToServer({
      walletAddress: ctx.walletAddress,
      chainId: ctx.chainId,
      sequenceNumber: reading.sequenceNumber.toString(),
      cardIndex: reading.cardIndex,
      isReversed: reading.isReversed,
      feedId: reading.feedId,
      oracleSnapshotHash: reading.oracleSnapshotHash,
      randomNumber: reading.randomNumber,
      callbackTxHash: cb,
      requestTxHash: requestTxHash || undefined,
      realm: realm ?? asset,
      stance,
      timeframe,
      truth,
      interpretation,
      rawSnapshot: {
        asset,
        assetSymbol,
        price,
        timestamp: Date.now(),
      },
    });
  }
}

function readPastEntropyTxHashes(
  sequenceNumber: bigint,
  chainTxHash: string
): { requestTxHash: string | null; callbackTxHash: string | null } {
  if (typeof window === "undefined") {
    return {
      requestTxHash: null,
      callbackTxHash: chainTxHash?.trim() || null,
    };
  }

  let requestTxHash: string | null = null;
  let callbackTxHash: string | null = chainTxHash?.trim() || null;

  try {
    const raw = window.localStorage.getItem(`reading-${sequenceNumber.toString()}`);
    if (raw) {
      const p = JSON.parse(raw) as {
        requestTxHash?: string | null;
        callbackTxHash?: string | null;
      };
      if (typeof p.requestTxHash === "string" && p.requestTxHash.trim()) {
        requestTxHash = p.requestTxHash.trim();
      }
      if (typeof p.callbackTxHash === "string" && p.callbackTxHash.trim()) {
        callbackTxHash = p.callbackTxHash.trim();
      }
    }
  } catch (e) {
    devWarn("my-readings:entropy-tx-hashes", e);
  }

  if (!requestTxHash) {
    const orra = readOrraReadingRecord(sequenceNumber);
    if (orra?.requestTxHash?.trim()) {
      requestTxHash = orra.requestTxHash.trim();
    }
  }

  return { requestTxHash, callbackTxHash };
}

interface MyReadingsProps {
  mobileView: 'list' | 'detail';
  setMobileView: (v: 'list' | 'detail') => void;
}

export function MyReadings({ mobileView, setMobileView }: MyReadingsProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const state = useSyncExternalStore(
    subscribePastReadings,
    getPastReadingsSnapshot,
    getPastReadingsServerSnapshot
  );

  const retry = useCallback(() => {
    if (address) void loadPastReadingsForAddress(address, { force: true });
  }, [address]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const addrKey = address?.toLowerCase() ?? "";
  const items = useMemo(
    () =>
      state.byAddress === addrKey && state.status === "ready" ? state.items : [],
    [addrKey, state.byAddress, state.items, state.status]
  );
  const effectiveKey =
    items.length === 0
      ? null
      : selectedKey && items.some((item) => item.key === selectedKey)
        ? selectedKey
        : items[0].key;

  const selectedReading = useMemo(
    () => (effectiveKey ? (items.find((item) => item.key === effectiveKey) ?? null) : null),
    [items, effectiveKey]
  );

  const onPastInterpretationComplete = useCallback(
    (fullText: string) => {
      if (!selectedReading || fullText === PAST_READING_NO_INTERP || !fullText.trim()) return;
      const existing = readOrraReadingRecord(selectedReading.sequenceNumber);
      if (existing?.interpretation === fullText) return;
      if (!address) return;
      const resolvedChainId =
        typeof chainId === "number" && Number.isFinite(chainId) ? chainId : 84532;
      persistPastReadingOrraRecord(selectedReading, fullText, {
        walletAddress: address,
        chainId: resolvedChainId,
      });
    },
    [selectedReading, address, chainId]
  );

  const [pastDownloadBusy, setPastDownloadBusy] = useState(false);
  /** Keyed by reading so switching selection does not show another card’s error. */
  const [pastDownloadError, setPastDownloadError] = useState<{
    readingKey: string;
    message: string;
  } | null>(null);
  const pastDownloadLockRef = useRef(false);

  const handlePastReadingDownload = useCallback(async () => {
    if (!selectedReading || pastDownloadLockRef.current) return;
    const card = MAJOR_ARCANA[selectedReading.cardIndex];
    if (!card) return;
    pastDownloadLockRef.current = true;
    setPastDownloadBusy(true);
    setPastDownloadError(null);
    try {
      const stored = readStoredInterpretation(selectedReading.sequenceNumber);
      const exportInterp =
        stored?.trim() && stored !== PAST_READING_NO_INTERP ? stored : card.meaning;
      const drawnDateStr =
        selectedReading.blockTimestamp != null
          ? new Date(selectedReading.blockTimestamp * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—";
      await downloadReadingAsPng({
        cardIndex: selectedReading.cardIndex,
        cardOrientation: selectedReading.isReversed ? "reversed" : "upright",
        drawnDateStr,
        walletAddress: address,
        realm: readPastReadingListAssetLabel(selectedReading.sequenceNumber) ?? undefined,
        realmSymbol: readPastReadingFeedSymbol(selectedReading.sequenceNumber) ?? undefined,
        interpretation: exportInterp,
        sequenceNumberForFile: selectedReading.sequenceNumber.toString(),
      });
    } catch (e) {
      setPastDownloadError({
        readingKey: selectedReading.key,
        message:
          e instanceof Error ? e.message : "Could not download this reading.",
      });
    } finally {
      pastDownloadLockRef.current = false;
      setPastDownloadBusy(false);
    }
  }, [selectedReading, address]);

  const pastDownloadErrorMessage =
    selectedReading &&
    pastDownloadError?.readingKey === selectedReading.key
      ? pastDownloadError.message
      : null;

  if (!isConnected || !address) {
    return (
      <div className="my-readings flex flex-col items-center gap-6 py-8">
        <p className="max-w-xl text-center font-sans text-lg font-light leading-relaxed text-ink-700 sm:text-xl">
          Connect your wallet to view past readings
        </p>
        <ReadingConnectInline />
      </div>
    );
  }

  if (
    state.byAddress &&
    state.byAddress !== addrKey &&
    (state.status === "ready" || state.status === "error")
  ) {
    return (
      <div className="my-readings flex flex-col items-center gap-4 py-10 max-w-md mx-auto text-center">
        <p className="text-[13px] font-light text-ink-600">
          Readings shown are for another account. Load again for this wallet.
        </p>
        <button
          type="button"
          className="oracle-button reading-nav-oracle-cta px-5 py-2 text-[11px] font-semibold tracking-[0.12em] uppercase"
          onClick={retry}
        >
          Load for this wallet
        </button>
      </div>
    );
  }

  if (state.status === "idle") {
    return <MyReadingsChainLoading />;
  }

  if (state.status === "loading") {
    return <MyReadingsChainLoading />;
  }

  if (state.status === "error" && state.byAddress === addrKey) {
    return (
      <div className="my-readings flex flex-col items-center gap-4 py-10 max-w-md mx-auto">
        <p className="text-center text-[13px] font-medium text-danger leading-relaxed">
          {state.error}
        </p>
        <button
          type="button"
          className="oracle-button reading-nav-oracle-cta px-5 py-2 text-[11px] font-semibold tracking-[0.12em] uppercase"
          onClick={retry}
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="my-readings py-12 text-center space-y-4">
        <p className="text-[14px] font-light text-ink-600 max-w-sm mx-auto">
          No readings yet — seek the cards to begin.
        </p>
        <button
          type="button"
          className="text-[11px] font-semibold tracking-[0.14em] uppercase text-accent-light hover:opacity-90"
          onClick={retry}
        >
          Refresh list
        </button>
      </div>
    );
  }

  return (
    <div className="my-readings flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch md:gap-6 lg:gap-8">
      <aside
        className={`my-readings__list scrollbar-hide min-h-0 w-full shrink-0 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-2 pr-1 pt-3 md:!block md:max-h-none md:h-full md:w-[min(248px,30vw)] md:max-w-[248px] md:flex-none md:pb-3 md:pr-3 md:pt-4 ${mobileView === 'detail' ? 'hidden' : 'flex-1'}`}
        aria-label="Past readings list"
      >
        <ul className="space-y-3 pb-3 md:pb-4">
          {items.map((r) => {
            const card = MAJOR_ARCANA[r.cardIndex];
            const name = card
              ? `${card.name}${r.isReversed ? " (Reversed)" : ""}`
              : `Card #${r.cardIndex}`;
            const listAsset = readPastReadingListAssetLabel(r.sequenceNumber);
            const assetFeedLine = listAsset
              ? `${listAsset} · Feed #${r.feedId}`
              : `Feed #${r.feedId}`;
            const isActive = selectedReading?.key === r.key;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => { setSelectedKey(r.key); setMobileView('detail'); }}
                  className={`qflow-option ${isActive ? "qflow-option--selected" : ""}`}
                  style={
                    isActive
                      ? {
                          boxShadow:
                            "inset 0 1px 0 color-mix(in srgb, var(--accent-light) 22%, transparent), 0 0 0 0.5px color-mix(in srgb, var(--accent) 45%, transparent), 0 6px 14px color-mix(in srgb, var(--accent) 10%, transparent)",
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start gap-3">
                    <div className="h-[64px] w-[44px] shrink-0 overflow-hidden rounded-md border border-surface-3 bg-surface-1">
                      {card ? (
                        <Image
                          src={card.image}
                          alt=""
                          width={88}
                          height={128}
                          className="h-full w-full object-cover"
                          style={r.isReversed ? { transform: "rotate(180deg)" } : undefined}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-ink-500">?</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="qflow-option-copy text-[13px] font-semibold leading-snug">{name}</p>
                      <p className="mt-1 text-[11px] font-medium text-ink-500 qflow-option-copy">
                        {assetFeedLine}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-ink-500 qflow-option-copy">
                        {formatTime(r.blockTimestamp)}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section
        className={`my-readings__detail min-h-0 min-w-0 flex-col overflow-hidden md:!flex md:flex-1 md:pl-0 ${
          mobileView === "detail" ? "flex w-full" : "hidden"
        }`}
        aria-label="Selected reading"
      >
        {selectedReading ? (
          (() => {
            const card = MAJOR_ARCANA[selectedReading.cardIndex];
            const name = card
              ? `${card.name}${selectedReading.isReversed ? " (Reversed)" : ""}`
              : `Card #${selectedReading.cardIndex}`;
            const orientation: CardOrientation = selectedReading.isReversed ? "reversed" : "upright";
            const storedInterp = readStoredInterpretation(selectedReading.sequenceNumber);
            const interpText = storedInterp ?? PAST_READING_NO_INTERP;
            const feedSymbol = readPastReadingFeedSymbol(selectedReading.sequenceNumber);
            const entropyTx = readPastEntropyTxHashes(
              selectedReading.sequenceNumber,
              selectedReading.txHash
            );
            return (
              <div className="my-readings__detail-scroll scrollbar-hide flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-8 pt-1 sm:px-4 md:px-5 md:pb-10 md:pt-2">
                <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 md:gap-8">
                  <div className="relative z-[80] mt-2 flex flex-col items-center gap-3 px-1 pt-10 sm:px-2 sm:pt-12 md:pt-14">
                    <div className="mx-auto w-[min(69vw,210px)] sm:w-[min(76vw,248px)] md:w-[min(88vw,268px)]">
                      <CardReveal cardIndex={selectedReading.cardIndex} orientation={orientation} />
                    </div>
                    <div className="max-w-md text-center">
                      <p className="text-[20px] font-light leading-tight text-ink-900">{name}</p>
                      <p className="text-[12px] font-medium text-ink-500">
                        Drawn {formatTime(selectedReading.blockTimestamp)}
                      </p>
                    </div>
                    <div className="flex min-w-[12rem] flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          void handlePastReadingDownload();
                        }}
                        disabled={pastDownloadBusy}
                        className="oracle-button reading-nav-oracle-cta reading-nav-oracle-cta--compact reading-nav-oracle-cta--no-pulse"
                        aria-label="Download reading image"
                      >
                        <span className="reading-nav-oracle-cta-inner">
                          <svg
                            className="oracle-button-svg"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden
                          >
                            <path d="M11 4h2v8.25l2.85-2.85 1.4 1.4L12 16.05l-5.25-5.25 1.4-1.4L11 12.25V4z" />
                            <path d="M5 17h14v3H5v-3z" opacity={0.6} />
                          </svg>
                          <span className="oracle-button-txt-wrap">
                            <span className="oracle-button-txt oracle-button-txt-1" aria-hidden>
                              {Array.from(pastDownloadBusy ? "Saving…" : "Download Reading").map(
                                (ch, i) => (
                                  <span key={`past-dl-a-${i}`} className="oracle-button-letter">
                                    {ch === " " ? "\u00a0" : ch}
                                  </span>
                                )
                              )}
                            </span>
                            <span className="oracle-button-txt oracle-button-txt-2" aria-hidden>
                              {Array.from(pastDownloadBusy ? "Saving…" : "Download Reading").map(
                                (ch, i) => (
                                  <span key={`past-dl-b-${i}`} className="oracle-button-letter">
                                    {ch === " " ? "\u00a0" : ch}
                                  </span>
                                )
                              )}
                            </span>
                          </span>
                        </span>
                      </button>
                      {pastDownloadErrorMessage && (
                        <p className="text-center text-[11px] font-medium text-danger">
                          {pastDownloadErrorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="relative z-0 w-full">
                    <Interpretation
                      key={selectedReading.sequenceNumber.toString()}
                      text={interpText}
                      onTypewriterComplete={onPastInterpretationComplete}
                    />
                  </div>

                  <div className="relative z-0 w-full">
                    <ReadingReceipt
                      key={`receipt-${selectedReading.key}`}
                      sequenceNumber={selectedReading.sequenceNumber}
                      feedId={selectedReading.feedId}
                      feedSymbol={feedSymbol}
                      oracleSnapshotHash={selectedReading.oracleSnapshotHash}
                      attestedRaw={null}
                    />
                  </div>

                  <div className="relative z-0 w-full">
                    <EntropyProof
                      key={`entropy-${selectedReading.key}`}
                      sequenceNumber={selectedReading.sequenceNumber}
                      requestTxHash={entropyTx.requestTxHash}
                      callbackTxHash={entropyTx.callbackTxHash}
                    />
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <p className="px-1 py-4 text-center text-[13px] font-medium text-ink-500 md:py-8">
            Select a reading to view details.
          </p>
        )}
      </section>
    </div>
  );
}

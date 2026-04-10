"use client";

interface Props {
  sequenceNumber: bigint | null;
  requestTxHash: string | null;
  callbackTxHash: string | null;
  showSequenceNumber?: boolean;
}

function EntropyProofLinkCta({ href, label }: { href: string; label: string }) {
  const chars = Array.from(label);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="oracle-button reading-nav-oracle-cta reading-nav-oracle-cta--compact reading-entropy-proof-cta"
      aria-label={label}
    >
      <span className="reading-nav-oracle-cta-inner">
        <span className="oracle-button-txt-wrap">
          <span className="oracle-button-txt oracle-button-txt-1" aria-hidden>
            {chars.map((ch, i) => (
              <span key={`a-${i}`} className="oracle-button-letter">
                {ch === " " ? "\u00a0" : ch}
              </span>
            ))}
          </span>
          <span className="oracle-button-txt oracle-button-txt-2" aria-hidden>
            {chars.map((ch, i) => (
              <span key={`b-${i}`} className="oracle-button-letter">
                {ch === " " ? "\u00a0" : ch}
              </span>
            ))}
          </span>
        </span>
      </span>
    </a>
  );
}

export function EntropyProof({
  sequenceNumber,
  requestTxHash,
  callbackTxHash,
  showSequenceNumber = true,
}: Props) {
  if (sequenceNumber === null) return null;

  const rpcUrl =
    process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://sepolia.base.org";
  const isSepolia = rpcUrl.toLowerCase().includes("sepolia");
  const txBase = isSepolia ? "https://sepolia.basescan.org/tx/" : "https://basescan.org/tx/";
  const entropyChainParam = isSepolia ? "all-testnet" : "all-mainnet";
  const entropySearchTx = callbackTxHash ?? requestTxHash;
  const explorerUrl = entropySearchTx
    ? `https://entropy-explorer.pyth.network/?search=${encodeURIComponent(entropySearchTx)}&chain=${entropyChainParam}`
    : "https://entropy-explorer.pyth.network/";

  return (
    <div className="w-full max-w-2xl mx-auto opacity-0 animate-fade-up">
      <div className="card-surface px-7 py-6 flex flex-col gap-4">
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-400">
          entropy proof
        </p>
        {showSequenceNumber && (
          <p className="-mt-2 text-[20px] font-semibold text-ink-900 leading-none">
            #{sequenceNumber.toString()}
          </p>
        )}
        <p className="text-[11px] sm:text-[12px] text-ink-400 leading-relaxed">
          Verify this reading is cryptographically fair. The card was drawn from verifiable on-chain randomness - not controlled by Orra.
        </p>
        <div className="reading-entropy-proof-actions flex flex-wrap">
          {requestTxHash && (
            <EntropyProofLinkCta href={`${txBase}${requestTxHash}`} label="request tx" />
          )}
          {callbackTxHash && (
            <EntropyProofLinkCta href={`${txBase}${callbackTxHash}`} label="callback tx" />
          )}
          <EntropyProofLinkCta href={explorerUrl} label="entropy explorer" />
        </div>
        {!callbackTxHash && (
          <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-ink-400 mb-1">
            callback pending
          </p>
        )}
      </div>
    </div>
  );
}

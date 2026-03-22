"use client";

interface Props {
  sequenceNumber: bigint | null;
}

export function EntropyProof({ sequenceNumber }: Props) {
  if (sequenceNumber === null) return null;

  const explorerUrl = `https://entropy-explorer.pyth.network/?sequence=${sequenceNumber.toString()}`;

  return (
    <div className="w-full max-w-md mx-auto opacity-0 animate-fade-up">
      <div className="card-surface px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-ink-400 mb-1">
            entropy proof
          </p>
          <p className="text-[13px] font-semibold text-ink-900 tabular">
            #{sequenceNumber.toString()}
          </p>
        </div>
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="btn-push">
          <span className="btn-shadow" />
          <span className="btn-edge" />
          <span className="btn-front !py-1.5 !px-3 !text-[10px] uppercase tracking-widest">verify</span>
        </a>
      </div>
    </div>
  );
}

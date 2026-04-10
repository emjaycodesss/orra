"use client";

import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useDisconnect } from "wagmi";

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function OracleWalletGlyph() {
  return (
    <svg
      className="oracle-button-svg"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M5 5.5h14a2 2 0 0 1 2 2V8H3v-.5a2 2 0 0 1 2-2z"
        opacity={0.48}
      />
      <path d="M4.5 9h15A1.5 1.5 0 0 1 21 10.5v7A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-7A1.5 1.5 0 0 1 4.5 9z" />
      <rect x="14" y="12" width="5.5" height="6" rx="1" opacity={0.36} />
    </svg>
  );
}

function OracleDisconnectGlyph() {
  return (
    <svg
      className="oracle-button-svg"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4v2H5v14h4v2z"
        opacity={0.38}
      />
      <path d="M16 7l5 5-5 5v-3h-6v-2h6V7z" />
    </svg>
  );
}

export function OracleBackGlyph() {
  return (
    <svg
      className="oracle-button-svg"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M20 11H7.85l4.7-4.7-1.4-1.4L4 12l7.15 7.1 1.4-1.4L7.85 13H20v-2z" />
    </svg>
  );
}

export function ReadingOracleIconChevron() {
  return (
    <svg
      className="oracle-button-svg"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M8.5 5.5 16 12l-7.5 6.5V5.5z" opacity={0.32} />
      <path d="M10 7l5 5-5 5V7z" />
    </svg>
  );
}

export function ReadingOracleIconCards() {
  return (
    <svg
      className="oracle-button-svg"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="2.5" y="8.5" width="10" height="13" rx="1.5" ry="1.5" opacity={0.4} />
      <rect x="5.5" y="6.25" width="10" height="13" rx="1.5" ry="1.5" opacity={0.72} />
      <rect x="8.5" y="4" width="10" height="13" rx="1.5" ry="1.5" />
      <circle cx="13.5" cy="9.75" r="1.15" opacity={0.55} />
    </svg>
  );
}


/** Letter-styled oracle CTA (same shell as ritual / wallet actions on `/reading`). */
export function ReadingOracleNavCta({
  label,
  ariaLabel,
  onClick,
  compact,
  disabled,
  glyph,
  revealLabelOnHover,
  className,
}: {
  label: string;
  ariaLabel: string;
  onClick: () => void;
  compact?: boolean;
  disabled?: boolean;
  glyph: ReactNode;
  revealLabelOnHover?: boolean;
  className?: string;
}) {
  const chars = Array.from(label);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`oracle-button reading-nav-oracle-cta${compact ? " reading-nav-oracle-cta--compact" : ""}${revealLabelOnHover ? " reading-nav-oracle-cta--reveal" : ""}${className ? ` ${className}` : ""}`}
      aria-label={ariaLabel}
    >
      <span className="reading-nav-oracle-cta-inner">
        {glyph}
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
    </button>
  );
}

export function ReadingWalletHeader() {
  const { disconnect } = useDisconnect();

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openChainModal }) => {
        if (!mounted) {
          return (
            <div
              className="min-h-[2.85rem] w-[min(100vw-2rem,320px)]"
              aria-hidden
            />
          );
        }
        const connected = account && chain;
        if (!connected) return null;

        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="rounded-xl bg-danger px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-white"
            >
              wrong network
            </button>
          );
        }

        return (
          <div className="reading-wallet-hud flex max-w-[min(100vw-2rem,360px)] flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
            <span
              className="tabular max-w-[200px] truncate text-[12px] font-medium text-ink-300"
              title={account.address}
            >
              {shortAddress(account.address)}
            </span>
            <ReadingOracleNavCta
              label="Disconnect"
              ariaLabel="Disconnect wallet"
              compact
              revealLabelOnHover
              className="reading-nav-oracle-cta--no-pulse"
              glyph={<OracleDisconnectGlyph />}
              onClick={() => disconnect()}
            />
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

const CONNECT_LABEL = "Connect wallet";

function ReadingOracleConnectButton({
  onClick,
  compact,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <ReadingOracleNavCta
      label={CONNECT_LABEL}
      ariaLabel="Connect wallet"
      onClick={onClick}
      compact={compact}
      glyph={<OracleWalletGlyph />}
    />
  );
}

export function ReadingConnectPrimary() {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) =>
        mounted ? (
          <ReadingOracleConnectButton onClick={openConnectModal} />
        ) : (
          <div className="min-h-[3.35rem] w-[min(100%,320px)] rounded-xl bg-surface-3/50" aria-hidden />
        )
      }
    </ConnectButton.Custom>
  );
}

export function ReadingConnectInline() {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) =>
        mounted ? (
          <ReadingOracleConnectButton onClick={openConnectModal} compact />
        ) : null
      }
    </ConnectButton.Custom>
  );
}

export function ReadingRitualOracleCta({
  label,
  ariaLabel,
  onClick,
  compact = true,
  disabled,
  glyph,
  className,
}: {
  label: string;
  ariaLabel: string;
  onClick: () => void;
  compact?: boolean;
  disabled?: boolean;
  glyph: ReactNode;
  className?: string;
}) {
  return (
    <ReadingOracleNavCta
      label={label}
      ariaLabel={ariaLabel}
      onClick={onClick}
      compact={compact}
      disabled={disabled}
      glyph={glyph}
      className={className}
    />
  );
}

export function ReadingHistoryBackCta({ onClick }: { onClick: () => void }) {
  return (
    <ReadingOracleNavCta
      label="Back"
      ariaLabel="Back to reading"
      onClick={onClick}
      compact
      revealLabelOnHover
      glyph={<OracleBackGlyph />}
      className="reading-nav-oracle-cta--history-back"
    />
  );
}

"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        return (
          <div {...(!mounted && { "aria-hidden": true, style: { opacity: 0, pointerEvents: "none" as const, userSelect: "none" as const } })}>
            {!connected ? (
              <button onClick={openConnectModal} className="btn-push">
                <span className="btn-shadow" />
                <span className="btn-edge" />
                <span className="btn-front !py-2 !px-5 !text-[11px] uppercase tracking-widest">connect wallet</span>
              </button>
            ) : chain.unsupported ? (
              <button onClick={openChainModal}
                className="px-5 py-2.5 text-[12px] font-semibold uppercase tracking-widest text-white bg-storm rounded-xl">
                wrong network
              </button>
            ) : (
              <button onClick={openAccountModal}
                className="px-4 py-2 text-[12px] font-semibold text-ink-700 bg-surface-1 border border-surface-3 rounded-xl shadow-sm hover:shadow-md hover:border-accent/20 transition-all">
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import {
  RainbowKitProvider,
  lightTheme,
} from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { type ReactNode, useRef } from "react";
import { ReadingAudioProvider } from "@/components/reading/ReadingAudioProvider";

const rpcUrl = process.env.NEXT_PUBLIC_BASE_RPC_URL ?? "https://sepolia.base.org";
const isTestnet = rpcUrl.includes("sepolia");

const config = isTestnet
  ? createConfig({
      chains: [baseSepolia],
      transports: { [baseSepolia.id]: http(rpcUrl) },
      ssr: true,
    })
  : createConfig({
      chains: [base],
      transports: { [base.id]: http(rpcUrl) },
      ssr: true,
    });

export function Providers({ children }: { children: ReactNode }) {
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient();
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClientRef.current}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: "#7C3AED",
            accentColorForeground: "white",
            borderRadius: "medium",
          })}
        >
          <ReadingAudioProvider>{children}</ReadingAudioProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

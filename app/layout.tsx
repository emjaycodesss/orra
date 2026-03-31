import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Providers } from "./providers";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Orra",
  description: "Tarot readings with live Pyth markets and verifiable on-chain randomness.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${manrope.variable}`}>
      <body className="min-h-screen antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Providers } from "./providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "orra -- market oracle",
  description: "A market oracle powered by Pyth Pro and Pyth Entropy v2.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

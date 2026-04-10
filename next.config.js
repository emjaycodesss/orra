const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s2.coinmarketcap.com",
        pathname: "/static/img/coins/**",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
        pathname: "/**",
      },
    ],
  },
  // Avoid wrong workspace root when multiple lockfiles exist (fixes tracing + odd dev bundler edge cases).
  outputFileTracingRoot: path.join(__dirname),
  // Smaller per-route bundles & faster dev resolution for icon-heavy imports.
  experimental: {
    optimizePackageImports: ["lucide-react", "@tanstack/react-query"],
  },
  /** Browsers still request /favicon.ico; avoid 404 without duplicating large assets. */
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/orra.svg" }];
  },
  /**
   * Conservative defaults — avoids a strict CSP here so RainbowKit / wallet connectors keep working.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      // pino-pretty is an optional dep of pino (used by WalletConnect's logger).
      // It is never needed in the browser bundle — silence the missing-module warning.
      "pino-pretty": false,
    };
    return config;
  },
}

module.exports = nextConfig

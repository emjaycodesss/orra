import type { MarketSession } from "./oracleState";

export type AssetClass = "crypto" | "equity" | "fx" | "metal" | "commodity";

export function inferAssetClass(symbol: string): AssetClass {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.startsWith("CRYPTO.")) return "crypto";
  if (normalized.startsWith("EQUITY.")) return "equity";
  if (normalized.startsWith("FX.")) return "fx";
  if (normalized.startsWith("METAL.")) return "metal";
  if (normalized.startsWith("COMMODITY.") || normalized.startsWith("COMMODITIES.")) return "commodity";

  const base = normalized.split("/")[0];
  const fxBases = new Set(["EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "USD"]);
  const metalBases = new Set(["XAU", "XAG", "GOLD", "SILVER", "PLATINUM", "PALLADIUM"]);
  const cryptoBases = new Set([
    "BTC", "ETH", "SOL", "DOGE", "XRP", "AVAX", "LINK", "PEPE", "BONK", "WIF",
    "PYTH", "BNB", "ADA", "DOT", "MATIC", "UNI", "ATOM", "LTC", "NEAR", "ARB",
    "OP", "APT", "SUI", "TIA", "SEI", "INJ", "FTM", "ALGO", "FIL", "ICP", "HBAR",
    "VET", "AAVE", "MKR", "CRV", "RENDER", "GRT", "STX", "IMX", "SHIB", "TRX", "TON",
    "HYPE", "WLD", "JUP", "JTO", "W", "ONDO", "ENA", "PENDLE", "RAY",
  ]);

  if (metalBases.has(base)) return "metal";
  if (fxBases.has(base)) return "fx";
  if (cryptoBases.has(base)) return "crypto";
  return "equity";
}

export function assetClassLabel(assetClass: AssetClass): string {
  if (assetClass === "fx") return "FX";
  return assetClass.toUpperCase();
}

export function marketStateLabel(
  assetClass: AssetClass,
  hasLiveOracle: boolean,
  marketSession: MarketSession,
  isStale: boolean
): string {
  if (assetClass === "crypto") return "24/7";
  if (!hasLiveOracle) return "Feed pending";
  if (isStale) return "Feed quiet";
  if (marketSession === "closed") return "Market closed";
  if (marketSession === "regular") return "Market open";
  if (marketSession === "preMarket") return "Pre-market";
  return "After hours";
}

const CMC_IDS: Record<string, number> = {
  BTC: 1, ETH: 1027, SOL: 5426, BNB: 1839, XRP: 52, ADA: 2010,
  DOGE: 74, AVAX: 5805, DOT: 6636, MATIC: 3890, LINK: 1975,
  UNI: 7083, ATOM: 3794, LTC: 2, NEAR: 6535, ARB: 11841,
  OP: 11840, APT: 21794, SUI: 20947, TIA: 22861, SEI: 23149,
  INJ: 7226, FTM: 3513, ALGO: 4030, FIL: 2280, ICP: 8916,
  HBAR: 4642, VET: 3077, AAVE: 7278, MKR: 1518, CRV: 6538,
  RENDER: 5690, GRT: 6719, STX: 4847, IMX: 10603, PEPE: 24478,
  WIF: 28752, BONK: 23095, SHIB: 5994, TRX: 1958, TON: 11419,
  HYPE: 34608, WLD: 13502, JUP: 29210, PYTH: 28177, JTO: 28541,
  W: 29587, ONDO: 21159, ENA: 30171, PENDLE: 9481, RAY: 8526,
};

export function getAssetLogoUrl(symbol: string): string | null {
  const raw = symbol.split("/")[0];
  const base = (raw.includes(".") ? raw.split(".").pop()! : raw).toUpperCase();
  const cmcId = CMC_IDS[base];
  if (!cmcId) return null;
  return `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`;
}

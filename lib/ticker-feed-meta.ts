/**
 * Single source for ticker strip feeds: Pyth Lazer id, display symbol, and Hermes id for batched historical lookups.
 * Keeps `/api/pyth-history-snapshot` and `useTickerStrip` aligned.
 */
export interface TickerFeedMeta {
  id: number;
  symbol: string;
  label: string;
  historySymbol: string;
  hermesId: string;
}

export const TICKER_FEED_META: TickerFeedMeta[] = [
  { id: 1, symbol: "Crypto.BTC/USD", label: "BTC", historySymbol: "Crypto.BTC/USD", hermesId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
  { id: 2, symbol: "Crypto.ETH/USD", label: "ETH", historySymbol: "Crypto.ETH/USD", hermesId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
  { id: 6, symbol: "Crypto.SOL/USD", label: "SOL", historySymbol: "Crypto.SOL/USD", hermesId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" },
  { id: 14, symbol: "Crypto.XRP/USD", label: "XRP", historySymbol: "Crypto.XRP/USD", hermesId: "ec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8" },
  { id: 13, symbol: "Crypto.DOGE/USD", label: "DOGE", historySymbol: "Crypto.DOGE/USD", hermesId: "dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c" },
  { id: 18, symbol: "Crypto.AVAX/USD", label: "AVAX", historySymbol: "Crypto.AVAX/USD", hermesId: "93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7" },
  { id: 19, symbol: "Crypto.LINK/USD", label: "LINK", historySymbol: "Crypto.LINK/USD", hermesId: "8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221" },
  { id: 4, symbol: "Crypto.PEPE/USD", label: "PEPE", historySymbol: "Crypto.PEPE/USD", hermesId: "d69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4" },
  { id: 9, symbol: "Crypto.BONK/USD", label: "BONK", historySymbol: "Crypto.BONK/USD", hermesId: "72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419" },
  { id: 10, symbol: "Crypto.WIF/USD", label: "WIF", historySymbol: "Crypto.WIF/USD", hermesId: "4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc" },
  { id: 3, symbol: "Crypto.PYTH/USD", label: "PYTH", historySymbol: "Crypto.PYTH/USD", hermesId: "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff" },
  { id: 346, symbol: "Metal.XAU/USD", label: "GOLD", historySymbol: "Metal.XAU/USD", hermesId: "765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2" },
  { id: 345, symbol: "Metal.XAG/USD", label: "SILVER", historySymbol: "Metal.XAG/USD", hermesId: "f2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e" },
  { id: 327, symbol: "FX.EUR/USD", label: "EUR/USD", historySymbol: "FX.EUR/USD", hermesId: "a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b" },
];

/** Hermes hex id (lowercase) -> history symbol string for snapshot responses */
export const HERMES_ID_TO_HISTORY_SYMBOL: Map<string, string> = new Map(
  TICKER_FEED_META.map((m) => [m.hermesId.toLowerCase().replace(/^0x/, ""), m.historySymbol]),
);

/** History symbol -> Hermes id for batched `/v2/updates/price/{publish_time}` */
export const HISTORY_SYMBOL_TO_HERMES_ID: Map<string, string> = new Map(
  TICKER_FEED_META.map((m) => [m.historySymbol, m.hermesId]),
);

/** Pyth Lazer websocket endpoints — single source for stream/ticker/availability probes. */
export const PYTH_LAZER_WS_URLS = [
  "wss://pyth-lazer-0.dourolabs.app/v1/stream",
  "wss://pyth-lazer-1.dourolabs.app/v1/stream",
  "wss://pyth-lazer-2.dourolabs.app/v1/stream",
] as const;

export function pickWsUrl(): string {
  const urls = PYTH_LAZER_WS_URLS;
  return urls[Math.floor(Math.random() * urls.length)]!;
}

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

export const runtime = "nodejs";

import WebSocket from "ws";

const PYTH_WS_URLS = [
  "wss://pyth-lazer-0.dourolabs.app/v1/stream",
  "wss://pyth-lazer-1.dourolabs.app/v1/stream",
  "wss://pyth-lazer-2.dourolabs.app/v1/stream",
];

const PROPERTIES = [
  "price",
  "emaPrice",
  "confidence",
  "emaConfidence",
  "bestBidPrice",
  "bestAskPrice",
  "publisherCount",
  "marketSession",
  "feedUpdateTimestamp",
  "exponent",
];

export async function GET(request: Request) {
  const token = process.env.PYTH_PRO_TOKEN;
  if (!token) {
    return new Response("PYTH_PRO_TOKEN not configured", { status: 500 });
  }

  const url = new URL(request.url);
  const feedId = parseInt(url.searchParams.get("feedId") ?? "1", 10);

  const encoder = new TextEncoder();
  let ws: WebSocket | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const wsUrl = PYTH_WS_URLS[Math.floor(Math.random() * PYTH_WS_URLS.length)];
      ws = new WebSocket(wsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      ws.on("open", () => {
        ws!.send(
          JSON.stringify({
            type: "subscribe",
            subscriptionId: 1,
            priceFeedIds: [feedId],
            properties: PROPERTIES,
            formats: [],
            channel: "fixed_rate@1000ms",
            parsed: true,
            jsonBinaryEncoding: "hex",
          })
        );
      });

      ws.on("message", (data: WebSocket.Data) => {
        if (closed) return;
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "streamUpdated" && msg.parsed?.priceFeeds?.[0]) {
            const feed = msg.parsed.priceFeeds[0];
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(feed)}\n\n`)
            );
          }
        } catch {
          // ignore parse errors
        }
      });

      ws.on("error", () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      });

      ws.on("close", () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      });
    },
    cancel() {
      closed = true;
      ws?.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

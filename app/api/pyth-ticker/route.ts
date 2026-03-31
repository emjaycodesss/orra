export const runtime = "nodejs";

import WebSocket from "ws";
import { pickWsUrl, SSE_HEADERS } from "@/lib/pyth-ws";
import { devWarn } from "@/lib/dev-warn";

const TICKER_FEED_IDS = [1, 2, 6, 14, 13, 18, 19, 4, 9, 10, 3, 346, 345, 327];

export async function GET() {
  const token = process.env.PYTH_PRO_TOKEN;
  if (!token) {
    return new Response("PYTH_PRO_TOKEN not configured", { status: 500 });
  }

  const encoder = new TextEncoder();
  let ws: WebSocket | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      ws = new WebSocket(pickWsUrl(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      ws.on("open", () => {
        ws!.send(
          JSON.stringify({
            type: "subscribe",
            subscriptionId: 2,
            priceFeedIds: TICKER_FEED_IDS,
            properties: ["price", "exponent", "confidence", "emaPrice", "emaConfidence", "publisherCount", "bestBidPrice", "bestAskPrice"],
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
          if (msg.type === "streamUpdated" && msg.parsed?.priceFeeds) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(msg.parsed.priceFeeds)}\n\n`)
            );
          }
        } catch (e) {
          devWarn("api:pyth-ticker:ws-message", e);
        }
      });

      ws.on("error", () => {
        if (!closed) { closed = true; controller.close(); }
      });
      ws.on("close", () => {
        if (!closed) { closed = true; controller.close(); }
      });
    },
    cancel() {
      closed = true;
      ws?.close();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

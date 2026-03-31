export const runtime = "nodejs";

import WebSocket from "ws";
import { pickWsUrl, SSE_HEADERS } from "@/lib/pyth-ws";
import { devWarn } from "@/lib/dev-warn";

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
      ws = new WebSocket(pickWsUrl(), {
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
            const feed = msg.parsed.priceFeeds[0] as Record<string, unknown>;

            const normalized = {
              priceFeedId:          feed.priceFeedId,
              price:                feed.price,
              emaPrice:             feed.emaPrice,
              confidence:           feed.confidence,
              emaConfidence:        feed.emaConfidence,
              bestBidPrice:         feed.bestBidPrice,
              bestAskPrice:         feed.bestAskPrice,
              publisherCount:       feed.publisherCount,
              marketSession:        feed.marketSession,
              feedUpdateTimestamp:  feed.feedUpdateTimestamp,
              exponent:             feed.exponent,
            };

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(normalized)}\n\n`)
            );
          }
        } catch (e) {
          devWarn("api:pyth-stream:ws-message", e);
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

  return new Response(stream, { headers: SSE_HEADERS });
}

/**
 * Parses Hermes `/v2/updates/price/*` JSON `parsed[]` entries into scaled floats.
 *
 * Hermes v2 nests `publish_time` inside the `price` object (see Pyth "Fetch Price Updates"
 * — public Hermes does not require Pyth Pro). Older samples sometimes used a top-level
 * `publish_time` on each feed row; we accept both shapes.
 */

type ParsedFeedRow = {
  price?: { price?: string; conf?: string; expo?: number; publish_time?: number };
  publish_time?: number;
};

export function parseHermesParsedPrice(data: unknown): {
  price: number;
  confidence: number;
  publishTime: number;
} | null {
  if (!data || typeof data !== "object") return null;
  const parsed = (data as { parsed?: unknown[] }).parsed;
  const first = parsed?.[0];
  if (!first || typeof first !== "object") return null;
  const row = first as ParsedFeedRow;
  if (!row.price) return null;

  const publishTime =
    typeof row.publish_time === "number"
      ? row.publish_time
      : typeof row.price.publish_time === "number"
        ? row.price.publish_time
        : null;
  if (publishTime === null) return null;

  const rawPrice = Number(row.price.price ?? NaN);
  const rawConf = Number(row.price.conf ?? NaN);
  const expo = Number(row.price.expo ?? NaN);
  if (!Number.isFinite(rawPrice) || !Number.isFinite(rawConf) || !Number.isFinite(expo)) return null;
  const scale = 10 ** expo;
  const price = rawPrice * scale;
  const confidence = rawConf * scale;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(confidence) || confidence < 0) return null;
  return { price, confidence, publishTime };
}

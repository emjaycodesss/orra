export interface HistoricalContext {
  days: number;
  high: number;
  low: number;
  pricePercentile: number;
  dominantRegime: "bull" | "bear";
  bullDays: number;
  bearDays: number;
  totalDays: number;
}

function timeframeToDays(tf: string): number {
  const lower = tf.toLowerCase();
  if (lower.includes("hour")) return 1;
  if (lower.includes("day"))  return 3;
  if (lower.includes("week")) return 7;
  if (lower.includes("month")) return 30;
  if (lower.includes("year")) return 365;
  return 30;
}

function rangeBucket(days: number): string {
  if (days <= 1)  return "daily";
  if (days <= 14) return "weekly";
  return "monthly";
}

export async function fetchHistoricalContext(
  symbol: string,
  timeframe: string
): Promise<HistoricalContext | null> {
  const days = timeframeToDays(timeframe);
  if (days < 7) return null;

  try {
    const res = await fetch(
      `/api/pyth-history?symbol=${encodeURIComponent(symbol)}&range=${rangeBucket(days)}`
    );
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ t: number; c: number }>;
    if (!Array.isArray(data) || data.length < 2) return null;

    const closes = data.map((d) => d.c);
    const high = Math.max(...closes);
    const low  = Math.min(...closes);
    const current = closes[closes.length - 1];
    const range = high - low;
    const pricePercentile = range > 0
      ? Math.round(((current - low) / range) * 100)
      : 50;

    let bullDays = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) bullDays++;
    }
    const bearDays = closes.length - 1 - bullDays;

    return {
      days,
      high,
      low,
      pricePercentile,
      dominantRegime: bullDays > bearDays ? "bull" : "bear",
      bullDays,
      bearDays,
      totalDays: closes.length - 1,
    };
  } catch {
    return null;
  }
}

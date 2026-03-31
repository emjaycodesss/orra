const MAX_DECIMALS = 16;

function decimalsForMagnitude(value: number): number {
  const a = Math.abs(value);
  if (!isFinite(a) || a === 0) return 8;
  if (a >= 1) return 4;
  if (a >= 0.01) return 6;
  const log = Math.floor(Math.log10(a));
  return Math.min(MAX_DECIMALS, Math.max(8, -log + 4));
}

export function inferSharedDecimals(...values: number[]): number {
  const finite = values.filter((v) => typeof v === "number" && isFinite(v));
  if (finite.length === 0) return 8;
  const distinct = new Set(finite.map((v) => String(v)));
  if (distinct.size <= 1) {
    return decimalsForMagnitude(finite[0]);
  }
  let d = 2;
  for (; d <= MAX_DECIMALS; d++) {
    const labels = finite.map((v) => v.toFixed(d));
    if (new Set(labels).size === labels.length) break;
  }
  return Math.min(MAX_DECIMALS, d);
}

export function formatPriceAdaptive(price: number): string {
  if (price === 0) return "--";
  if (!isFinite(price)) return "--";
  if (price >= 1000)
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const d = decimalsForMagnitude(price);
  return price.toFixed(d);
}

export function formatUsdAdaptive(price: number): string {
  if (price === 0) return "$0";
  if (!isFinite(price)) return "--";
  const sign = price < 0 ? "-" : "";
  const v = Math.abs(price);
  if (v >= 1) return `${sign}$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (v >= 0.01) return `${sign}$${v.toFixed(4)}`;
  const d = decimalsForMagnitude(v);
  return `${sign}$${v.toFixed(d)}`;
}

function formatUsdWithDecimalCount(price: number, d: number): string {
  if (price === 0) return "$0";
  if (!isFinite(price)) return "--";
  const sign = price < 0 ? "-" : "";
  const v = Math.abs(price);
  const clampedD = Math.max(0, Math.min(MAX_DECIMALS, d));
  const s = v.toFixed(clampedD);
  const dot = s.indexOf(".");
  const intRaw = dot >= 0 ? s.slice(0, dot) : s;
  const frac = dot >= 0 ? s.slice(dot) : "";
  if (intRaw.length > 3 || v >= 1000) {
    const intGrouped = Number(intRaw).toLocaleString("en-US");
    return `${sign}$${intGrouped}${frac}`;
  }
  return `${sign}$${s}`;
}

export function formatUsdBidAsk(bid: number, ask: number): { bid: string; ask: string } {
  if (!isFinite(bid) || !isFinite(ask)) {
    return { bid: "--", ask: "--" };
  }
  if (bid <= 0 || ask <= 0) {
    return {
      bid: bid <= 0 ? "--" : formatUsdAdaptive(bid),
      ask: ask <= 0 ? "--" : formatUsdAdaptive(ask),
    };
  }
  if (bid === ask) {
    const s = formatUsdAdaptive(bid);
    return { bid: s, ask: s };
  }
  const d = inferSharedDecimals(bid, ask);
  return {
    bid: formatUsdWithDecimalCount(bid, d),
    ask: formatUsdWithDecimalCount(ask, d),
  };
}

export function formatUsdSpreadAbsolute(spreadAbs: number): string {
  if (spreadAbs === 0) return "$0";
  if (!isFinite(spreadAbs)) return "--";
  const v = Math.abs(spreadAbs);
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  const log = Math.log10(v);
  const d = Math.min(MAX_DECIMALS, Math.max(8, -Math.floor(log) + 2));
  const rounded = v.toFixed(d);
  if (Number.parseFloat(rounded) === 0 && v > 0) {
    return `$${v.toPrecision(4)}`;
  }
  return `$${rounded}`;
}

export function formatPeriodLowHigh(low: number, high: number): { low: string; high: string } {
  if (low <= 0 || high <= 0 || !isFinite(low) || !isFinite(high)) {
    return { low: "--", high: "--" };
  }
  const d = inferSharedDecimals(low, high);
  return { low: low.toFixed(d), high: high.toFixed(d) };
}

export function inferAxisDecimals(min: number, max: number, stepCount: number): number {
  if (!isFinite(min) || !isFinite(max)) return 6;
  const range = max - min;
  if (range <= 0 || !isFinite(range)) return decimalsForMagnitude((min + max) / 2);
  const ticks: number[] = [];
  for (let i = 0; i <= stepCount; i++) {
    ticks.push(min + (range * i) / stepCount);
  }
  return inferSharedDecimals(...ticks);
}

export function formatAxisPriceAdaptive(price: number, decimals: number): string {
  if (!isFinite(price)) return "--";
  if (price >= 100000)
    return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1000)
    return price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (price >= 100) return price.toFixed(Math.min(2, decimals));
  if (price >= 1) return price.toFixed(Math.min(4, decimals));
  return price.toFixed(decimals);
}

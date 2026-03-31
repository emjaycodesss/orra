import { describe, expect, it } from "vitest";
import {
  formatPriceAdaptive,
  formatUsdAdaptive,
  formatUsdBidAsk,
  inferSharedDecimals,
} from "./format-price";

describe("format-price", () => {
  it("formatPriceAdaptive returns -- for non-finite", () => {
    expect(formatPriceAdaptive(Number.NaN)).toBe("--");
    expect(formatPriceAdaptive(0)).toBe("--");
  });

  it("formatUsdAdaptive formats large values with grouping", () => {
    const s = formatUsdAdaptive(1234.56);
    expect(s).toContain("1");
    expect(s).toContain("234");
  });

  it("formatUsdBidAsk aligns decimals for close bid/ask", () => {
    const { bid, ask } = formatUsdBidAsk(1.001, 1.002);
    expect(bid.startsWith("$")).toBe(true);
    expect(ask.startsWith("$")).toBe(true);
  });

  it("inferSharedDecimals returns sensible value for distinct numbers", () => {
    expect(inferSharedDecimals(1.0, 1.01)).toBeGreaterThanOrEqual(2);
  });
});

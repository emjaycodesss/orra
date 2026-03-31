import { describe, expect, it } from "vitest";
import { computeOracleSnapshotHash } from "./oracle-snapshot-hash";
import type { PythStreamData } from "./oracleState";

/** Must match `testOracleSnapshotHashMatchesTsReference` in contracts/test/Orra.t.sol */
const REF_HEX =
  "0x06d7eb1f730b74cf5d05bf7ff61e0ba9846f0b738704b5615e221a9a8c301b6c" as const;

describe("computeOracleSnapshotHash", () => {
  it("matches Solidity abi.encodePacked reference", () => {
    const data: PythStreamData = {
      priceFeedId: 1,
      price: "100",
      emaPrice: "0",
      confidence: "2",
      emaConfidence: "3",
      bestBidPrice: "4",
      bestAskPrice: "5",
      publisherCount: 7,
      marketSession: "regular",
      feedUpdateTimestamp: 123,
      exponent: -8,
    };
    const h = computeOracleSnapshotHash(data);
    expect(h.toLowerCase()).toBe(REF_HEX.toLowerCase());
  });
});

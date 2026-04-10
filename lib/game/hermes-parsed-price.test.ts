import { describe, expect, it } from "vitest";
import { parseHermesParsedPrice } from "./hermes-parsed-price";

describe("parseHermesParsedPrice", () => {
  it("reads publish_time from price object (Hermes v2 REST)", () => {
    const doc = {
      parsed: [
        {
          id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
          price: {
            price: "6140993501000",
            conf: "3287868567",
            expo: -8,
            publish_time: 1714746101,
          },
        },
      ],
    };
    const r = parseHermesParsedPrice(doc);
    expect(r).not.toBeNull();
    expect(r!.publishTime).toBe(1714746101);
    expect(r!.price).toBeCloseTo(61409.93501, 4);
  });

  it("still accepts top-level publish_time if present", () => {
    const doc = {
      parsed: [
        {
          publish_time: 99,
          price: { price: "100000000", conf: "1000000", expo: -8 },
        },
      ],
    };
    const r = parseHermesParsedPrice(doc);
    expect(r?.publishTime).toBe(99);
  });
});

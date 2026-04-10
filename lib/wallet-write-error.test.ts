import { describe, expect, it } from "vitest";
import { humanizeWalletWriteError, isWalletUserRejectedError } from "./wallet-write-error";

describe("wallet-write-error", () => {
  it("detects viem user rejection message", () => {
    const err = new Error(
      "User rejected the request. Request Arguments: from: 0xe700... Contract Call: ...",
    );
    expect(isWalletUserRejectedError(err)).toBe(true);
    expect(humanizeWalletWriteError(err)).toContain("Transaction cancelled");
    expect(humanizeWalletWriteError(err)).toContain("nothing was sent");
  });

  it("passes through unrelated errors", () => {
    const err = new Error("insufficient funds");
    expect(isWalletUserRejectedError(err)).toBe(false);
    expect(humanizeWalletWriteError(err)).toBe("insufficient funds");
  });
});

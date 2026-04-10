/**
 * Normalize wallet / viem / ethers write errors for UI (matches reading draw behavior).
 */

/** Same copy as reading draw (`useOrraContract` / ReadingPageClient). */
const USER_CANCELLED_MESSAGE =
  "Transaction cancelled. No worries - your wallet rejected the request, so nothing was sent.";

/**
 * True when the user dismissed or rejected the signing / send prompt (MetaMask, etc.).
 */
export function isWalletUserRejectedError(error: unknown): boolean {
  const asAny = error as {
    code?: number | string;
    shortMessage?: string;
    reason?: string;
    message?: string;
    details?: string;
    cause?: unknown;
    info?: { error?: { code?: number | string; message?: string } };
  };

  const message = error instanceof Error ? error.message : String(error);
  const shortMessage = asAny?.shortMessage ?? "";
  const reason = asAny?.reason ?? "";
  const details = typeof asAny?.details === "string" ? asAny.details : "";
  const nestedCode = asAny?.info?.error?.code;
  const code = asAny?.code;
  const joined = `${message} ${shortMessage} ${reason} ${details}`.toLowerCase();

  if (
    code === "ACTION_REJECTED" ||
    code === 4001 ||
    nestedCode === 4001 ||
    joined.includes("user rejected") ||
    joined.includes("rejected the request") ||
    joined.includes("ethers-user-denied") ||
    joined.includes("denied transaction")
  ) {
    return true;
  }

  /** Viem sometimes nests the user rejection on `cause`. */
  if (asAny?.cause && asAny.cause !== error) {
    return isWalletUserRejectedError(asAny.cause);
  }

  return false;
}

/**
 * Friendly string for displaying after a failed `writeContract` / tx send.
 */
export function humanizeWalletWriteError(error: unknown): string {
  if (isWalletUserRejectedError(error)) {
    return USER_CANCELLED_MESSAGE;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Emit compact API timing JSON to stdout when `NODE_ENV=development` or `ORRA_API_TIMING_LOG=1`. */
function shouldLogApiTiming(): boolean {
  return process.env.NODE_ENV === "development" || process.env.ORRA_API_TIMING_LOG === "1";
}

/**
 * Convert an `unknown` error into a JSON-safe shape.
 * We keep it compact (message/name/stack) so logs remain queryable and cheap.
 */
function serializeUnknownError(err: unknown): {
  name?: string;
  message?: string;
  stack?: string;
  cause?: unknown;
} {
  if (err instanceof Error) {
    const maybeWithCause = err as Error & { cause?: unknown };
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause: maybeWithCause.cause,
    };
  }

  if (typeof err === "string") {
    return { message: err };
  }

  try {
    return { message: JSON.stringify(err) };
  } catch {
    return { message: String(err) };
  }
}

export function logApiTiming(
  route: string,
  durationMs: number,
  meta: Record<string, string | number | boolean | undefined> = {},
): void {
  if (!shouldLogApiTiming()) return;
  console.info(
    JSON.stringify({
      type: "orra_api_timing",
      route,
      durationMs,
      ...meta,
    }),
  );
}

/**
 * Structured API error logging.
 *
 * We intentionally log JSON to stdout/stderr so environments like Vercel / Fly / Render
 * can ingest it without extra transports. When/if we standardize on Winston, this
 * function is the single switch point for API error observability.
 */
export function logApiError(
  route: string,
  err: unknown,
  meta: Record<string, string | number | boolean | undefined> = {},
): void {
  console.error(
    JSON.stringify({
      type: "orra_api_error",
      route,
      error: serializeUnknownError(err),
      ...meta,
    }),
  );
}

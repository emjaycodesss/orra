// Timing JSON to stdout: ORRA_API_TIMING_LOG=1 in prod; always when NODE_ENV=development.
export function shouldLogApiTiming(): boolean {
  return process.env.NODE_ENV === "development" || process.env.ORRA_API_TIMING_LOG === "1";
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

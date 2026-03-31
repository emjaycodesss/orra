export function devWarn(scope: string, detail?: unknown): void {
  if (process.env.NODE_ENV !== "development") return;
  if (detail !== undefined) {
    console.warn(`[orra:${scope}]`, detail);
  } else {
    console.warn(`[orra:${scope}]`);
  }
}

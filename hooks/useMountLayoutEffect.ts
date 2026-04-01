import { useLayoutEffect, type EffectCallback } from "react";

/**
 * Runs a layout effect exactly once per component mount.
 * Use when setup must happen before paint.
 */
export function useMountLayoutEffect(effect: EffectCallback): void {
  useLayoutEffect(effect, []);
}

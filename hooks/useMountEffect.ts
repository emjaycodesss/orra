import { useEffect, type EffectCallback } from "react";

/**
 * Runs an effect exactly once per component mount.
 * Use this for one-time setup/cleanup against external systems.
 */
export function useMountEffect(effect: EffectCallback): void {
  useEffect(effect, []);
}

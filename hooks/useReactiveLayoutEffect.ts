import { useLayoutEffect, type DependencyList, type EffectCallback } from "react";

/**
 * Explicit wrapper for dependency-driven layout synchronization.
 * Keep usage narrow and only for paint-sensitive integrations.
 */
export function useReactiveLayoutEffect(effect: EffectCallback, deps: DependencyList): void {
  useLayoutEffect(effect, deps);
}

import { useEffect, type DependencyList, type EffectCallback } from "react";

/**
 * Explicit wrapper for dependency-driven external synchronization.
 * Keep usage narrow and prefer derived state/handlers when possible.
 */
export function useReactiveEffect(effect: EffectCallback, deps: DependencyList): void {
  useEffect(effect, deps);
}

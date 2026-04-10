export type AiQuestionSourceMode = "seed" | "live";

export interface AiMixState {
  seed: number;
  live: number;
}

/**
 * Picks the next source mode to keep batch generation near 50/50.
 * If counts are tied, alternate by total parity for stable distribution.
 */
export function chooseAiSourceMode(state?: Partial<AiMixState>): AiQuestionSourceMode {
  const seed = Number.isFinite(state?.seed) ? Number(state?.seed) : 0;
  const live = Number.isFinite(state?.live) ? Number(state?.live) : 0;
  if (seed < live) return "seed";
  if (live < seed) return "live";
  return (seed + live) % 2 === 0 ? "seed" : "live";
}

export function incrementAiMix(
  state: Partial<AiMixState> | undefined,
  mode: AiQuestionSourceMode,
): AiMixState {
  const next: AiMixState = {
    seed: Number.isFinite(state?.seed) ? Number(state?.seed) : 0,
    live: Number.isFinite(state?.live) ? Number(state?.live) : 0,
  };
  next[mode] += 1;
  return next;
}

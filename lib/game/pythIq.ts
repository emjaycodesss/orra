/**
 * Session Pyth IQ: weighted by boss tier faced (1-based boss index per question).
 */
export function computePythIq(
  entries: { correct: boolean; bossIndex: number }[],
): number {
  if (entries.length === 0) return 100;
  let w = 0;
  let c = 0;
  for (const e of entries) {
    const weight = 1 + 0.15 * e.bossIndex;
    w += weight;
    if (e.correct) c += weight;
  }
  const accuracy = c / w;
  let iq = 100 + 60 * (accuracy - 0.5);
  const maxBoss = entries.reduce((m, e) => Math.max(m, e.bossIndex), 0);
  iq *= 1 + 0.05 * maxBoss;
  return Math.round(Math.min(148, Math.max(72, iq)));
}

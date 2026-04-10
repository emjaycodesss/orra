import rawSeedFacts from "./seed-facts.json";

interface SeedFact {
  id: string;
  bossIndex: 0 | 1 | 2;
  topic: string;
  fact: string;
}

const seedFacts = rawSeedFacts as SeedFact[];

export function listSeedFactsForBoss(bossIndex: number): SeedFact[] {
  const normalized = bossIndex <= 0 ? 0 : bossIndex === 1 ? 1 : 2;
  return seedFacts.filter((f) => f.bossIndex === normalized);
}

export function pickSeedFactForBoss(
  bossIndex: number,
  recentIds: string[] = [],
): SeedFact | null {
  return pickSeedFactForBossExcluding(bossIndex, recentIds, new Set());
}

/**
 * Same as pickSeedFactForBoss but also skips ids in `alsoExclude` (e.g. other slots in the same prepare-run).
 */
function pickSeedFactForBossExcluding(
  bossIndex: number,
  recentIds: string[] = [],
  alsoExclude: ReadonlySet<string> = new Set(),
): SeedFact | null {
  const pool = listSeedFactsForBoss(bossIndex);
  if (pool.length === 0) return null;
  const filtered = pool.filter((f) => !recentIds.includes(f.id) && !alsoExclude.has(f.id));
  const source = filtered.length > 0 ? filtered : pool;
  return source[Math.floor(Math.random() * source.length)] ?? null;
}

export function nextRecentSeedFactIds(
  current: string[] | undefined,
  nextId: string,
  maxSize = 8,
): string[] {
  const prior = (current ?? []).filter((id) => id !== nextId);
  return [nextId, ...prior].slice(0, maxSize);
}

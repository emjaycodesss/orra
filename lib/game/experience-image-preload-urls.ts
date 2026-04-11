import { MAJOR_ARCANA } from "@/lib/cards";
import { OPPONENTS } from "@/lib/game/opponents";

/**
 * Static art used across `/portal` path tiles and Oracle Trivia Clash (boosters, HUD, arenas).
 * Fed to `<img loading="eager">` in the experience layout so the browser decodes before first reveal.
 */
/** Hero art for `/portal` path tiles — same paths as `next/image` when `unoptimized` is set. */
export const PORTAL_PATH_TILE_IMAGE_URLS = ["/revelation.webp", "/trivia_clash.webp"] as const;

const BOSS_ARENA_BACKGROUNDS = [
  "/bosses/planck_bg.webp",
  "/bosses/ktizz_bg.webp",
  "/bosses/chop_bg.webp",
] as const;

/** Booster spread uses the shared card back for every slot until zoom completes. */
const CARD_BACK = "/cards/back.webp" as const;

function dedupeSorted(urls: readonly string[]): string[] {
  return [...new Set(urls)].sort((a, b) => a.localeCompare(b));
}

/** All URLs to warm when any `(experience)` route mounts (portal, reading, game). */
export const EXPERIENCE_PRELOAD_IMAGE_URLS: readonly string[] = dedupeSorted([
  CARD_BACK,
  ...PORTAL_PATH_TILE_IMAGE_URLS,
  ...BOSS_ARENA_BACKGROUNDS,
  ...MAJOR_ARCANA.map((c) => c.image),
  ...OPPONENTS.map((o) => o.image),
]);

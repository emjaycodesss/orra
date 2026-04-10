/**
 * Normalize legacy X/Twitter avatar URLs to a higher-resolution variant.
 *
 * X commonly serves suffix variants such as `_normal`, `_bigger`, or `_mini`.
 * Rewriting to `_400x400` preserves the same avatar while improving clarity.
 */
export function normalizeAvatarUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(
    /_(normal|bigger|mini)(\.(?:jpg|jpeg|png|webp))(?:\?.*)?$/i,
    "_400x400$2",
  );
}

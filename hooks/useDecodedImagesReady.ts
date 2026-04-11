"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Waits until each URL has loaded and `decode()` has finished so the first paint can show pixels
 * immediately (avoids pop-in when `ExperienceImagePreload` and `next/image` share the same src).
 */
export function useDecodedImagesReady(urls: readonly string[]): boolean {
  const key = urls.join("\0");
  const [ready, setReady] = useState(() => urls.length === 0);

  useLayoutEffect(() => {
    if (urls.length === 0) {
      setReady(true);
      return;
    }

    setReady(false);
    let cancelled = false;

    void (async () => {
      await Promise.all(
        urls.map(async (src) => {
          const img = new Image();
          img.src = src;
          try {
            await img.decode();
          } catch {
            // Corrupt or blocked asset — still reveal UI so the route stays usable.
          }
        }),
      );
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` fingerprints `urls` content.
  }, [key]);

  return ready;
}

import { EXPERIENCE_PRELOAD_IMAGE_URLS } from "@/lib/game/experience-image-preload-urls";

/**
 * Off-screen eager `<img>` nodes: triggers fetch + decode for duel / portal artwork as soon as the
 * experience shell renders — no `useEffect`, so warmup is tied to the server+client tree, not an extra tick.
 * Keeps first boss intro, CSS arena layers, booster modal, and path chooser tiles from popping in blank.
 */
export function ExperienceImagePreload() {
  return (
    <div
      className="pointer-events-none fixed left-0 top-0 z-[-100] h-px w-px overflow-hidden opacity-0"
      aria-hidden
    >
      {EXPERIENCE_PRELOAD_IMAGE_URLS.map((src) => (
        <img
          key={src}
          src={src}
          alt=""
          width={1}
          height={1}
          loading="eager"
          decoding="async"
        />
      ))}
    </div>
  );
}

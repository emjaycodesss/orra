import type { ReactNode } from "react";
import { ExperienceImagePreload } from "@/components/game/ExperienceImagePreload";
import { ReadingOrbitShellProvider } from "@/components/reading/ReadingOrbitShell";

/**
 * Keeps the canvas orbit mounted across `/portal`, `/reading`, and `/game` so the animation
 * continues when the user picks a path after ENTER (no tear-down on client navigation).
 *
 * `ExperienceImagePreload` is a server fragment: static imgs only (no `useEffect`) so path tiles,
 * boss portraits, arena CSS backgrounds, and major-arcana art decode ahead of first in-view paint.
 */
export default function ExperienceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ExperienceImagePreload />
      <ReadingOrbitShellProvider>{children}</ReadingOrbitShellProvider>
    </>
  );
}

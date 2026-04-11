import type { ReactNode } from "react";
import { ExperienceImagePreload } from "@/components/game/ExperienceImagePreload";
import { ReadingOrbitShellProvider } from "@/components/reading/ReadingOrbitShell";

/**
 * Keeps the canvas orbit mounted across `/portal`, `/reading`, and `/game` so the animation
 * continues when the user picks a path after ENTER (no tear-down on client navigation).
 *
 * `ExperienceImagePreload` is a server fragment: static imgs only (no `useEffect`) so path tiles,
 * boss portraits, arena CSS backgrounds, and major-arcana art fetch early. Portal tiles use the same
 * `/public` URLs as `next/image` (`unoptimized`) plus `ReadingPathChooser` decode gating to avoid pop-in.
 */
export default function ExperienceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ExperienceImagePreload />
      <ReadingOrbitShellProvider>{children}</ReadingOrbitShellProvider>
    </>
  );
}

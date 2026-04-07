"use client";

import type { ReactNode } from "react";
import { ReadingOrbitShellProvider } from "@/components/reading/ReadingOrbitShell";

/**
 * Keeps the canvas orbit mounted across `/portal`, `/reading`, and `/game` so the animation
 * continues when the user picks a path after ENTER (no tear-down on client navigation).
 */
export default function ExperienceLayout({ children }: { children: ReactNode }) {
  return <ReadingOrbitShellProvider>{children}</ReadingOrbitShellProvider>;
}

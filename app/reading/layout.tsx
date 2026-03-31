import type { ReactNode } from "react";
import { ReadingOrbitShellProvider } from "@/components/reading/ReadingOrbitShell";

export default function ReadingLayout({ children }: { children: ReactNode }) {
  return <ReadingOrbitShellProvider>{children}</ReadingOrbitShellProvider>;
}

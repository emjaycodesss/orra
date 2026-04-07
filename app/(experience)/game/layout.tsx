import type { ReactNode } from "react";

/** Parent `(experience)` layout already applies `.reading-page.reading-page--orbit`. */
export default function GameLayout({ children }: { children: ReactNode }) {
  return <div className="relative min-h-screen">{children}</div>;
}

import { Suspense } from "react";
import PortalPageClient from "./PortalPageClient";

function PortalSearchParamsFallback() {
  return (
    <main
      className="reading-main--fill-viewport pointer-events-none relative z-10 flex flex-col"
      aria-busy="true"
      aria-label="Loading portal"
    >
      <span className="sr-only">Loading portal</span>
    </main>
  );
}

/**
 * Eager `PortalPageClient` bundle (no `dynamic()` chunk delay). `Suspense` is required because the client
 * uses `useSearchParams` during static generation.
 */
export default function PortalPage() {
  return (
    <Suspense fallback={<PortalSearchParamsFallback />}>
      <PortalPageClient />
    </Suspense>
  );
}

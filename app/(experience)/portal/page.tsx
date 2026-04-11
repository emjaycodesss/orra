import { Suspense } from "react";
import PortalPageClient from "./PortalPageClient";

/** Shown only until `useSearchParams` resolves (Next.js CSR bailout). Matches path-chooser preload styling. */
function PortalSearchParamsFallback() {
  return (
    <main
      className="reading-main--fill-viewport relative z-10 flex min-h-[50vh] flex-col items-center justify-center gap-4"
      aria-busy="true"
      aria-label="Loading portal"
    >
      <div className="reading-uiverse-loader reading-uiverse-loader--portal-paths" aria-hidden>
        <div className="reading-uiverse-loader__ring reading-uiverse-loader__ring-1" />
        <div className="reading-uiverse-loader__ring reading-uiverse-loader__ring-2" />
        <div className="reading-uiverse-loader__ring reading-uiverse-loader__ring-3" />
      </div>
      <p className="font-sans text-sm font-medium text-ink-500">Entering portal…</p>
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

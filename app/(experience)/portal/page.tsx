import dynamic from "next/dynamic";

const PortalPageClient = dynamic(() => import("./PortalPageClient"), {
  loading: () => (
    <span className="sr-only" aria-busy="true" aria-live="polite">
      Loading
    </span>
  ),
});

export default function PortalPage() {
  return <PortalPageClient />;
}

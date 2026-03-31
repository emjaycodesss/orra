import dynamic from "next/dynamic";

const ReadingPageClient = dynamic(() => import("./ReadingPageClient"), {
  loading: () => (
    <span className="sr-only" aria-busy="true" aria-live="polite">
      Loading
    </span>
  ),
});

export default function ReadingPage() {
  return <ReadingPageClient />;
}

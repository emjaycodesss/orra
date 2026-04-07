import dynamic from "next/dynamic";

const GamePageClient = dynamic(() => import("./GamePageClient"), {
  loading: () => (
    <span className="sr-only" aria-busy="true" aria-live="polite">
      Loading
    </span>
  ),
});

export default function GamePage() {
  return <GamePageClient />;
}

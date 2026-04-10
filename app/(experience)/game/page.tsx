import Image from "next/image";
import dynamic from "next/dynamic";

const GamePageClient = dynamic(() => import("./GamePageClient"), {
  loading: () => (
    <div className="reading-main-below-util-header flex min-h-dvh items-center justify-center px-4">
      <div className="reading-approach-logo-shell">
        <div className="reading-uiverse-loader" aria-hidden>
          <div className="reading-uiverse-loader__ring reading-uiverse-loader__ring-1" />
          <div className="reading-uiverse-loader__ring reading-uiverse-loader__ring-2" />
          <div className="reading-uiverse-loader__ring reading-uiverse-loader__ring-3" />
          <div className="reading-uiverse-loader__core">
            <Image
              src="/orra.svg"
              alt=""
              className="reading-uiverse-loader__mark"
              width={60}
              height={60}
              priority={false}
            />
          </div>
        </div>
      </div>
      <span className="sr-only" aria-busy="true" aria-live="polite">
        Loading Oracle Trivia Clash
      </span>
    </div>
  ),
});

export default function GamePage() {
  return <GamePageClient />;
}

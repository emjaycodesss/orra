"use client";

import Image from "next/image";

export function ReadingApproachLogoLoader() {
  return (
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
        />
      </div>
    </div>
  );
}

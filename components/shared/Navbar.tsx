"use client";

import Image from "next/image";
import Link from "next/link";
import { useWallClockMs } from "@/hooks/useWallClock";
import { useReadingAudio } from "@/components/reading/ReadingAudioProvider";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

export function Navbar({ children }: { children?: React.ReactNode }) {
  const readingAudio = useReadingAudio();
  const nowMs = useWallClockMs();
  const datetime = nowMs === 0 ? "" : new Date(nowMs).toLocaleString("en-US", DATE_FORMAT);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface-1/80 backdrop-blur-xl">
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-0 sm:gap-6 px-3 sm:px-6">

        <Link
          href="/"
          className="order-1 flex h-14 shrink-0 items-center gap-0 cursor-default"
          onClick={(e) => e.preventDefault()}
        >
          <Image src="/orra.svg" alt="" width={24} height={24} className="w-6 h-6" priority />
          <span className="-ml-px text-xl font-extrabold italic tracking-tight text-ink-900">
            rra
          </span>
        </Link>

        <div className="order-2 sm:order-3 ml-auto sm:ml-0 flex h-14 shrink-0 items-center gap-3 sm:gap-5">
          <span className="hidden sm:inline text-[11px] font-medium text-ink-400 tabular tracking-wide uppercase">
            {datetime}
          </span>
          <Link
            href="/portal"
            prefetch
            className="oracle-button"
            aria-label="Seek the Cards"
            onClick={() => {
              void readingAudio?.beginAmbientFromReadingNav();
            }}
          >
            <svg
              className="oracle-button-svg"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="2.5" y="8.5" width="10" height="13" rx="1.5" ry="1.5" opacity={0.4} />
              <rect x="5.5" y="6.25" width="10" height="13" rx="1.5" ry="1.5" opacity={0.72} />
              <rect x="8.5" y="4" width="10" height="13" rx="1.5" ry="1.5" />
              <circle cx="13.5" cy="9.75" r="1.15" opacity={0.55} />
            </svg>
            <span className="oracle-button-txt-wrap">
              <span className="oracle-button-txt oracle-button-txt-1" aria-hidden>
                {"Seek the Cards".split("").map((ch, i) => (
                  <span
                    key={`a-${i}`}
                    className={`oracle-button-letter${ch === " " ? " oracle-button-letter--gap" : ""}`}
                  >
                    {ch === " " ? "\u00a0" : ch}
                  </span>
                ))}
              </span>
              <span className="oracle-button-txt oracle-button-txt-2" aria-hidden>
                {"Seek the Cards".split("").map((ch, i) => (
                  <span
                    key={`b-${i}`}
                    className={`oracle-button-letter${ch === " " ? " oracle-button-letter--gap" : ""}`}
                  >
                    {ch === " " ? "\u00a0" : ch}
                  </span>
                ))}
              </span>
            </span>
          </Link>
        </div>

        {children && (
          <div className="order-3 sm:order-2 flex w-full sm:w-auto items-center gap-2 sm:gap-3 pb-2 sm:pb-0 sm:h-14 sm:flex-1">
            {children}
          </div>
        )}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}

function getTime() {
  return new Date().toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const SERVER_TIME = "";

export function Navbar() {
  const datetime = useSyncExternalStore(subscribeClock, getTime, () => SERVER_TIME);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14 bg-surface-1/80 backdrop-blur-xl border-b border-surface-3">
      <Link href="/" className="flex items-center gap-2.5 group">
        <div className="w-2 h-2 rounded-full bg-accent status-dot" />
        <span className="text-[15px] font-semibold tracking-tight text-ink-900 group-hover:text-accent transition-colors">
          orra
        </span>
      </Link>
      <div className="flex items-center gap-5">
        <span className="text-[11px] font-medium text-ink-400 tabular tracking-wide uppercase">
          {datetime}
        </span>
        <Link href="/reading" className="btn-push">
          <span className="btn-shadow" />
          <span className="btn-edge" />
          <span className="btn-front !py-2 !px-4 !text-[11px] uppercase tracking-widest">consult oracle</span>
        </Link>
      </div>
    </nav>
  );
}

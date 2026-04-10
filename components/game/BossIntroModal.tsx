"use client";

import { useMountEffect } from "@/hooks/useMountEffect";
import { useRef, useState } from "react";
import Image from "next/image";
import { OPPONENTS } from "@/lib/game/opponents";
import { getBossIntroMeta } from "@/lib/game/duel-ui-transitions";

interface Props {
  bossIndex: number;
  onComplete: () => void;
}

export function BossIntroModal({ bossIndex, onComplete }: Props) {
  const [countdown, setCountdown] = useState(3);
  const completeTimeoutRef = useRef<number | null>(null);
  const boss = OPPONENTS[bossIndex] ?? OPPONENTS[0]!;

  useMountEffect(() => {
    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          completeTimeoutRef.current = window.setTimeout(onComplete, 300);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
      if (completeTimeoutRef.current != null) {
        window.clearTimeout(completeTimeoutRef.current);
        completeTimeoutRef.current = null;
      }
    };
  });

  const { title, subtitle } = getBossIntroMeta({ bossIndex });

  return (
    <div
      className="boss-intro-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boss-intro-title"
    >
      <div className="boss-intro-modal-content">
        <div className="boss-intro-avatar-container">
          <div className="boss-intro-avatar-frame">
            <Image
              src={boss.image}
              alt={boss.displayName}
              width={160}
              height={160}
              className="boss-intro-avatar"
              unoptimized
              priority
            />
          </div>
        </div>

        <div className="boss-intro-text-content">
          <h2 id="boss-intro-title" className="boss-intro-title">
            {title}
          </h2>
          <p className="boss-intro-subtitle">{subtitle}</p>
          <p className="boss-intro-flavor">
            &ldquo;{boss.flavor}&rdquo;
          </p>
        </div>

        <div className="boss-intro-countdown-container">
          <div className="boss-intro-countdown-ring" aria-hidden>
            <svg viewBox="0 0 100 100" className="boss-intro-countdown-svg">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                opacity="0.1"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="boss-intro-countdown-progress"
                style={{
                  strokeDasharray: `${(3 - countdown) / 3 * 283} 283`,
                }}
              />
            </svg>
          </div>
          <div className="boss-intro-countdown-text" aria-live="assertive">
            {countdown}
          </div>
        </div>

        <p className="boss-intro-action-text">
          {countdown > 0 ? "Meet the guardian in..." : "Step into the clash."}
        </p>
      </div>

      <style jsx>{`
        .boss-intro-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 22% 18%, rgba(167, 139, 250, 0.14), transparent 42%),
            radial-gradient(circle at 78% 20%, rgba(56, 189, 248, 0.11), transparent 46%),
            rgba(18, 9, 29, 0.96);
          backdrop-filter: blur(10px);
          animation: fadeIn 0.3s ease-out forwards;
          padding: max(18px, env(safe-area-inset-top, 0px))
            max(14px, env(safe-area-inset-right, 0px))
            max(18px, env(safe-area-inset-bottom, 0px))
            max(14px, env(safe-area-inset-left, 0px));
        }

        .boss-intro-modal-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.15rem;
          width: min(100%, 440px);
          padding: clamp(1rem, 2.5vw, 1.6rem);
          border-radius: 20px;
          border: 1px solid color-mix(in srgb, var(--surface-4) 64%, var(--accent-light) 36%);
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 88%, #fff 12%), var(--surface-1));
          box-shadow:
            0 18px 48px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          animation: slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .boss-intro-avatar-container {
          position: relative;
          width: clamp(92px, 23vw, 132px);
          height: clamp(92px, 23vw, 132px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .boss-intro-avatar-frame {
          width: 100%;
          height: 100%;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(100, 70, 150, 0.60);
          background: linear-gradient(135deg, rgba(40, 20, 80, 0.40) 0%, transparent 100%);
          box-shadow:
            inset -1px -1px 3px rgba(0, 0, 0, 0.50),
            inset 1px 1px 2px rgba(255, 255, 255, 0.10),
            0 4px 8px rgba(0, 0, 0, 0.60);
        }

        .boss-intro-avatar {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          border-radius: 10px;
          border: 0;
          animation: pulse 2s ease-in-out infinite;
        }

        .boss-intro-text-content {
          text-align: center;
          animation: fadeInUp 0.6s ease-out 0.2s backwards;
        }

        .boss-intro-title {
          font-size: clamp(1.2rem, 4.4vw, 1.7rem);
          font-weight: 700;
          color: var(--ink-900);
          margin: 0 0 0.45rem;
          letter-spacing: -0.02em;
        }

        .boss-intro-subtitle {
          font-size: 0.82rem;
          color: var(--ink-500);
          font-weight: 500;
          margin: 0;
        }

        .boss-intro-flavor {
          margin: 0.55rem auto 0;
          max-width: 28ch;
          font-size: 0.76rem;
          color: var(--ink-400);
          line-height: 1.35;
        }

        .boss-intro-countdown-container {
          position: relative;
          width: clamp(74px, 20vw, 108px);
          height: clamp(74px, 20vw, 108px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeInUp 0.6s ease-out 0.3s backwards;
        }

        .boss-intro-countdown-ring {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          color: var(--accent-light);
        }

        .boss-intro-countdown-svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }

        .boss-intro-countdown-progress {
          transition: stroke-dasharray 0.3s ease-out;
        }

        .boss-intro-countdown-text {
          position: relative;
          z-index: 1;
          font-size: clamp(1.7rem, 8vw, 2.65rem);
          font-weight: 700;
          color: var(--accent-light);
          line-height: 1;
          font-variant-numeric: tabular-nums;
          animation: countdownPulse 0.5s ease-out;
        }

        .boss-intro-action-text {
          font-size: 0.78rem;
          color: var(--ink-500);
          text-transform: uppercase;
          letter-spacing: 0.11em;
          font-weight: 600;
          animation: fadeInUp 0.6s ease-out 0.4s backwards;
          margin: 0;
        }

        @media (max-width: 520px) {
          .boss-intro-modal-content {
            border-radius: 16px;
            gap: 0.9rem;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes pulse-glow {
          0%,
          100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.1);
          }
        }

        @keyframes countdownPulse {
          from {
            transform: scale(1.2);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .boss-intro-modal-backdrop,
          .boss-intro-modal-content,
          .boss-intro-avatar,
          .boss-intro-text-content,
          .boss-intro-countdown-container,
          .boss-intro-countdown-progress,
          .boss-intro-countdown-text,
          .boss-intro-action-text {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
}

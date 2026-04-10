"use client";

import { useState } from "react";
import gsap from "gsap";
import { useReactiveLayoutEffect } from "@/hooks/useReactiveLayoutEffect";

interface AnimatedCounterProps {
  /** Starting value for the animation */
  from: number;
  /** Ending value for the animation */
  to: number;
  /** Animation duration in seconds (default: 0.8) */
  duration?: number;
  /** Delay before animation starts in seconds */
  delay?: number;
  /** Optional formatter function to transform the displayed value */
  formatter?: (value: number) => string;
  /** Optional CSS class name for the container */
  className?: string;
}

/**
 * AnimatedCounter — animates a number from one value to another using GSAP.
 *
 * Usage:
 * ```tsx
 * <AnimatedCounter
 *   from={0}
 *   to={1250}
 *   duration={1}
 *   formatter={(n) => Math.round(n).toLocaleString()}
 * />
 * ```
 *
 * Note: formatter is intentionally excluded from the effect dependency array
 * because it's only used for display formatting via the onUpdate callback,
 * not for animation triggering. Including it would cause unnecessary re-animations
 * when a parent component passes new function references.
 */
export function AnimatedCounter({
  from,
  to,
  duration = 0.8,
  delay = 0,
  formatter = (n) => Math.round(n).toString(),
  className = "",
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(formatter(from));

  useReactiveLayoutEffect(() => {
    const obj = { value: from };

    gsap.to(obj, {
      value: to,
      duration,
      delay,
      onUpdate() {
        setDisplayValue(formatter(obj.value));
      },
      ease: "power2.out",
    });

    return () => {
      gsap.killTweensOf(obj);
    };
  }, [from, to, duration, delay]);

  return (
    <span className={className}>
      {displayValue}
    </span>
  );
}

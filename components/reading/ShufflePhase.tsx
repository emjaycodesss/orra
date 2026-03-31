"use client";

import {
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import gsap from "gsap";
import { ReadingApproachLogoLoader } from "@/components/reading/ReadingApproachLogoLoader";
import { useReadingAudio } from "@/components/reading/ReadingAudioProvider";
import {
  SHUFFLE_PHASE_CARD_COUNT as CARD_COUNT,
  SHUFFLE_PHASE_DURATION as DURATION,
  SHUFFLE_PHASE_SCALE_DURATION as SCALE_DURATION,
  SHUFFLE_PHASE_SCALE_OFFSET as SCALE_OFFSET,
  SHUFFLE_PHASE_Y_OFFSET as Y_OFFSET,
} from "@/lib/shuffle-phase-timing";

const BACK_SRC = "/cards/back.svg";

type ContractWaitStatus =
  | "requesting"
  | "waiting"
  | "revealed"
  | "error"
  | "timeout"
  | "idle";

interface Props {
  isDrawComplete: boolean;
  contractStatus: ContractWaitStatus;
  onSettleComplete: () => void;
}

export function ShufflePhase({
  isDrawComplete,
  contractStatus,
  onSettleComplete,
}: Props) {
  const readingAudio = useReadingAudio();
  const rootRef = useRef<HTMLDivElement>(null);
  const onSettleCompleteRef = useRef(onSettleComplete);
  onSettleCompleteRef.current = onSettleComplete;

  const reducedMotion = useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  useLayoutEffect(() => {
    if (reducedMotion) {
      if (isDrawComplete) queueMicrotask(() => onSettleCompleteRef.current());
      return;
    }

    if (isDrawComplete) {
      queueMicrotask(() => onSettleCompleteRef.current());
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const cards = Array.from(root.querySelectorAll<HTMLElement>(".shuffle-phase__card"));
    const stack = root.querySelector<HTMLElement>(".shuffle-phase__cards");
    const backs = Array.from(root.querySelectorAll<HTMLImageElement>(".shuffle-phase__back"));
    if (!stack || !cards.length) return;

    const cardsMidIndex = Math.floor(cards.length / 2);
    let completed = false;
    const doneOnce = () => {
      if (completed) return;
      completed = true;
      onSettleCompleteRef.current();
    };

    const ctx = gsap.context(() => {
      const waitForBacks = () =>
        Promise.all(
          backs.map((img) => {
            if (img.complete && img.naturalWidth > 0) return Promise.resolve();
            if (typeof img.decode === "function") {
              return img.decode().catch(() => undefined);
            }
            return new Promise<void>((resolve) => {
              const done = () => resolve();
              img.addEventListener("load", done, { once: true });
              img.addEventListener("error", done, { once: true });
            });
          }),
        );

      const driftIn = () =>
        gsap.timeline().from(stack, {
          yPercent: -Y_OFFSET / 3,
          duration: DURATION,
          ease: "power2.inOut",
          yoyoEase: true,
        });

      const driftOut = () =>
        gsap.timeline().to(stack, {
          yPercent: Y_OFFSET / 3,
          duration: DURATION,
          ease: "power2.inOut",
          yoyoEase: true,
        });

      const scaleCards = () =>
        gsap
          .timeline()
          .to(cards, {
            scale: (i: number) =>
              i <= cardsMidIndex
                ? 1 - i * SCALE_OFFSET
                : 1 - (cards.length - 1 - i) * SCALE_OFFSET,
            delay: DURATION / 3,
            duration: SCALE_DURATION,
            ease: "expo.inOut",
            yoyoEase: true,
          })
          .to(cards, { scale: 1, duration: SCALE_DURATION });

      const shuffleCards = () =>
        gsap
          .timeline()
          .set(cards, {
            y: (i: number) => -i * 0.5,
          })
          .fromTo(
            cards,
            {
              rotate: 45,
              yPercent: -Y_OFFSET,
            },
            {
              duration: DURATION,
              rotate: 65,
              yPercent: Y_OFFSET,
              stagger: DURATION * 0.03,
              ease: "expo.inOut",
              yoyoEase: true,
            },
          );

      const shuffleDeck = () =>
        gsap
          .timeline()
          .add(driftIn())
          .add(shuffleCards(), "<")
          .add(scaleCards(), "<")
          .add(driftOut(), "<55%");

      void waitForBacks().then(() => {
        if (!rootRef.current) return;
        gsap.set(cards, { clearProps: "transform" });
        gsap.set(stack, { clearProps: "transform" });

        readingAudio?.startWalletShuffleLoop();

        gsap.timeline({ repeat: -1, yoyoEase: true }).add(shuffleDeck());
      });
    }, root);

    return () => {
      readingAudio?.stopWalletShuffleLoop();
      ctx.revert();
    };
  }, [isDrawComplete, reducedMotion, readingAudio]);

  const caption =
    contractStatus === "requesting"
      ? "Awaiting wallet signature…"
      : isDrawComplete
        ? "The oracle has chosen…"
        : contractStatus === "waiting"
          ? "The oracle draws your card…"
          : "Preparing the cards…";

  return (
    <div
      ref={rootRef}
      className="shuffle-phase"
      role="presentation"
    >
      <div className="shuffle-phase__header">
        <div className="shuffle-phase__logo" aria-hidden>
          <ReadingApproachLogoLoader />
        </div>
        <p className="shuffle-phase__caption font-sans text-center text-[15px] font-light text-ink-700">
          {caption}
        </p>
      </div>
      <ul className="shuffle-phase__cards" aria-hidden>
        {Array.from({ length: CARD_COUNT }, (_, i) => (
          <li key={i} className="shuffle-phase__card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BACK_SRC} alt="" className="shuffle-phase__back" draggable={false} />
          </li>
        ))}
      </ul>
    </div>
  );
}

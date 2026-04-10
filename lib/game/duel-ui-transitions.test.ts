import { describe, expect, it } from "vitest";
import {
  buildComboDamagePayload,
  didBossDefeatBetweenSnapshots,
  getBossIntroMeta,
  isBossDefeatTransition,
  shouldRevealArenaBossDefeatAfterAnswer,
} from "@/lib/game/duel-ui-transitions";

describe("duel-ui-transitions", () => {
  it("first intro title is Guardian 1: Planck", () => {
    const meta = getBossIntroMeta({
      bossIndex: 0,
    });
    expect(meta.title).toBe("Guardian 1: Planck");
  });

  it("always introduces first boss as guardian", () => {
    const meta = getBossIntroMeta({
      bossIndex: 0,
    });
    expect(meta.title).toContain("Guardian 1");
    expect(meta.subtitle).toBe("Here comes Planck. Hold your line.");
  });

  it("uses numbered title for non-first boss intro", () => {
    const meta = getBossIntroMeta({
      bossIndex: 2,
    });
    expect(meta.title).toBe("Guardian 3: Chop");
  });

  it("returns false when there is no boss change", () => {
    expect(
      isBossDefeatTransition({
        previousBossIndex: 1,
        currentBossIndex: 1,
        answerBossIndex: 1,
      }),
    ).toBe(false);
  });

  it("returns false when boss change goes backward", () => {
    expect(
      isBossDefeatTransition({
        previousBossIndex: 2,
        currentBossIndex: 1,
        answerBossIndex: 2,
      }),
    ).toBe(false);
  });

  it("returns false when answer is tied to wrong boss", () => {
    expect(
      isBossDefeatTransition({
        previousBossIndex: 0,
        currentBossIndex: 1,
        answerBossIndex: 1,
      }),
    ).toBe(false);
  });

  it("returns true on forward change with previous-boss answer", () => {
    expect(
      isBossDefeatTransition({
        previousBossIndex: 0,
        currentBossIndex: 1,
        answerBossIndex: 0,
      }),
    ).toBe(true);
  });

  it("marks defeat when bossesDefeated increases without boss index change", () => {
    expect(
      didBossDefeatBetweenSnapshots({
        previousBossIndex: 2,
        previousBossesDefeated: 2,
        currentBossIndex: 2,
        currentBossesDefeated: 3,
      }),
    ).toBe(true);
  });

  it("marks defeat when boss index advances", () => {
    expect(
      didBossDefeatBetweenSnapshots({
        previousBossIndex: 1,
        previousBossesDefeated: 1,
        currentBossIndex: 2,
        currentBossesDefeated: 1,
      }),
    ).toBe(true);
  });

  it("does not mark defeat for regressive or out-of-order snapshots", () => {
    expect(
      didBossDefeatBetweenSnapshots({
        previousBossIndex: 2,
        previousBossesDefeated: 2,
        currentBossIndex: 1,
        currentBossesDefeated: 3,
      }),
    ).toBe(false);
    expect(
      didBossDefeatBetweenSnapshots({
        previousBossIndex: 2,
        previousBossesDefeated: 2,
        currentBossIndex: 2,
        currentBossesDefeated: 1,
      }),
    ).toBe(false);
  });

  it("does not mark defeat when neither boss index nor defeats increase", () => {
    expect(
      didBossDefeatBetweenSnapshots({
        previousBossIndex: 1,
        previousBossesDefeated: 1,
        currentBossIndex: 1,
        currentBossesDefeated: 1,
      }),
    ).toBe(false);
  });

  it("shouldRevealArenaBossDefeatAfterAnswer: true when buffered nextSession ends run (final guardian)", () => {
    const pending = { nextSession: { bossIndex: 2, phase: "ended" as const } };
    expect(
      shouldRevealArenaBossDefeatAfterAnswer({
        bossChangedFromPrev: false,
        lastEntryBossIndex: 2,
        sessionBossIndex: 2,
        comboPendingKo: pending,
      }),
    ).toBe(true);
  });

  it("shouldRevealArenaBossDefeatAfterAnswer: true when next guardian buffered (mid-run)", () => {
    const pending = { nextSession: { bossIndex: 2, phase: "running" as const } };
    expect(
      shouldRevealArenaBossDefeatAfterAnswer({
        bossChangedFromPrev: false,
        lastEntryBossIndex: 1,
        sessionBossIndex: 1,
        comboPendingKo: pending,
      }),
    ).toBe(true);
  });

  it("shouldRevealArenaBossDefeatAfterAnswer: false when no KO buffer and same boss", () => {
    expect(
      shouldRevealArenaBossDefeatAfterAnswer({
        bossChangedFromPrev: false,
        lastEntryBossIndex: 2,
        sessionBossIndex: 2,
        comboPendingKo: null,
      }),
    ).toBe(false);
  });

  it("builds combo damage payload with fixed hp subtraction", () => {
    expect(buildComboDamagePayload(35)).toEqual({ comboDamageHp: 35 });
  });

  it("builds combo damage payload for zero edge case", () => {
    expect(buildComboDamagePayload(0)).toEqual({ comboDamageHp: 0 });
  });
});

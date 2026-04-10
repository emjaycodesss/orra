import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-observability";
import type { PreparedGameQuestion } from "@/lib/game/types";
import {
  enforceGameRateLimit,
  jsonApiError,
  requireGameSession,
  writeSessionWithCasRetry,
} from "@/lib/game/api-route-helpers";
import { LIVE_ORACLE_UNAVAILABLE_MESSAGE } from "@/lib/game/oracle-client-messages";
import {
  assignOracleFeedsToTwelveLiveSlots,
  fetchGameOracleSnapshot,
} from "@/lib/game/pyth-hermes-snapshot";
import type { LiveQuestionSlotSpec } from "@/lib/game/question-ai-service";
import { incrementAiMix } from "@/lib/game/question-ai-policy";
import { bankQuestionToPrepared, pickBankQuestionsForPrepare } from "@/lib/game/question-bank";

const PER_BOSS_COUNT = 7;
const BANK_SLOTS_PER_BOSS = 3;
const LIVE_SLOTS_PER_BOSS = 4;

/** Cap recent bank ids stored on the session to bound payload size. */
const MAX_RECENT_BANK_IDS = 200;

export async function POST(req: Request) {
  const sessionResult = await requireGameSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const { sessionId: id } = sessionResult;
  let current = sessionResult.session;
  if (current.phase !== "lobby") {
    return jsonApiError("phase_invalid", 400);
  }

  const xHandle = current.twitterHandle?.replace(/^@+/, "").trim();
  const devMock = process.env.ORRA_TRIVIA_DEV_MOCK === "1";
  if (!xHandle && !devMock) {
    return jsonApiError("twitter_required", 400);
  }

  const limited = enforceGameRateLimit(req, {
    route: "game.prepare-run",
    sessionId: id,
    ipMax: 10,
    sessionMax: 3,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const existing = current.preGeneratedQuestionsByBoss ?? {};
  const alreadyPrepared = [0, 1, 2].every(
    (boss) => (existing[String(boss)]?.length ?? 0) >= PER_BOSS_COUNT,
  );
  if (alreadyPrepared) {
    return NextResponse.json({ prepared: true, alreadyPrepared: true });
  }

  /**
   * Lazy-load AI + oracle helpers only when preparation runs (keeps fast exits lean).
   */
  const { generateBatchedLivePrepareQuestions } = await import("@/lib/game/question-ai-service");

  const oracle = await fetchGameOracleSnapshot();
  if (!oracle || oracle.feedsWithReturn.length < 3) {
    logApiError(
      "api/game/prepare-run",
      new Error("live_snapshot_unavailable"),
      {
        sessionId: id,
        reason: !oracle ? "oracle_null" : "insufficient_feeds_with_return",
        feedsWithReturn: oracle?.feedsWithReturn.length ?? 0,
        feedCount: oracle?.feeds.length ?? 0,
      },
    );
    return jsonApiError("live_snapshot_unavailable", 503, {
      message: LIVE_ORACLE_UNAVAILABLE_MESSAGE,
    });
  }

  let liveFeedBySlot: ReturnType<typeof assignOracleFeedsToTwelveLiveSlots>;
  try {
    liveFeedBySlot = assignOracleFeedsToTwelveLiveSlots(oracle.feedsWithReturn);
  } catch (err) {
    logApiError("api/game/prepare-run", err, { sessionId: id, phase: "assignOracleFeeds" });
    return jsonApiError("live_snapshot_unavailable", 503, {
      message: LIVE_ORACLE_UNAVAILABLE_MESSAGE,
    });
  }

  const liveSlots: LiveQuestionSlotSpec[] = [];
  for (let b = 0; b < 3; b += 1) {
    const bossIndex = b as 0 | 1 | 2;
    for (let j = 0; j < LIVE_SLOTS_PER_BOSS; j += 1) {
      const i = b * LIVE_SLOTS_PER_BOSS + j;
      liveSlots.push({
        bossIndex,
        questionType: Math.random() < 0.5 ? "mcq" : "tf",
        feed: liveFeedBySlot[i]!,
      });
    }
  }

  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const byBoss: Record<string, PreparedGameQuestion[]> = {};
    let mixState = current.aiQuestionMix;
    const excludeBank = new Set(current.aiRecentBankQuestionIds ?? []);
    const pickedBankIdsThisPrepare: string[] = [];

    let batch: Awaited<ReturnType<typeof generateBatchedLivePrepareQuestions>>;
    try {
      batch = await generateBatchedLivePrepareQuestions({
        snapshot: oracle,
        slots: liveSlots,
        mixState,
        idPrefix: `prepare_${id}`,
      });
    } catch (err) {
      logApiError("api/game/prepare-run", err, { sessionId: id, phase: "generateBatchedLivePrepareQuestions" });
      return jsonApiError("live_snapshot_unavailable", 503, {
        message: LIVE_ORACLE_UNAVAILABLE_MESSAGE,
      });
    }
    mixState = batch.nextMixState;

    const liveByBoss: Record<number, PreparedGameQuestion[]> = { 0: [], 1: [], 2: [] };
    for (const q of batch.questions) {
      liveByBoss[q.bossIndex]!.push(q);
    }

    for (const bossIndex of [0, 1, 2] as const) {
      const bucket: PreparedGameQuestion[] = [];
      const needBank = BANK_SLOTS_PER_BOSS;
      const bankPicks = pickBankQuestionsForPrepare({
        bossIndex,
        count: needBank,
        excludeIds: excludeBank,
      });
      if (bankPicks.length < needBank) {
        return jsonApiError("bank_pool_insufficient", 503);
      }
      for (const bq of bankPicks) {
        excludeBank.add(bq.id);
        pickedBankIdsThisPrepare.push(bq.id);
        const pq = bankQuestionToPrepared(bq, bossIndex);
        bucket.push(pq);
        mixState = incrementAiMix(mixState, "seed");
      }

      const liveChunk = liveByBoss[bossIndex] ?? [];
      for (let j = 0; j < liveChunk.length; j += 1) {
        const q = liveChunk[j]!;
        bucket.push(q);
      }
      byBoss[String(bossIndex)] = bucket;
    }

    const prevRecent = current.aiRecentBankQuestionIds ?? [];
    const nextRecent = [...prevRecent, ...pickedBankIdsThisPrepare].slice(-MAX_RECENT_BANK_IDS);

    const next = {
      ...current,
      aiQuestionMix: mixState,
      aiRecentBankQuestionIds: nextRecent,
      preGeneratedQuestionsByBoss: byBoss,
    };
    const casResult = await writeSessionWithCasRetry(id, current, () => next, 1);
    if (casResult.persisted) {
      return NextResponse.json({ prepared: true, alreadyPrepared: false });
    }
    if (!casResult.session) {
      return jsonApiError("expired", 401);
    }
    current = casResult.session;
  }

  return jsonApiError("write_conflict", 409);
}

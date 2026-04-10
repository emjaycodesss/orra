import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-observability";
import { fetchGameOracleSnapshot, pickOracleFeedForAdHocQuestion } from "@/lib/game/pyth-hermes-snapshot";
import { LIVE_ORACLE_UNAVAILABLE_MESSAGE } from "@/lib/game/oracle-client-messages";
import type { LiveData } from "@/lib/game/question-ai-service";
import {
  enforceGameRateLimit,
  jsonApiError,
  parseJsonBody,
  requireGameSession,
  writeSessionWithCasRetry,
} from "@/lib/game/api-route-helpers";

function normalizeBossIndex(input: unknown): 0 | 1 | 2 | null {
  if (typeof input !== "number" || !Number.isInteger(input)) return null;
  if (input === 0 || input === 1 || input === 2) return input;
  return null;
}

/** Optional: which basket symbol to anchor the ad-hoc question (e.g. BTC, BTC/USD, GOLD). */
function normalizeOracleSymbol(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const t = input.trim();
  return t.length > 0 ? t : undefined;
}

function normalizeLiveData(input: unknown): LiveData | null {
  if (!input || typeof input !== "object") return null;
  const data = input as Partial<LiveData> & { confidence?: number; confidencePct?: number };
  if (typeof data.symbol !== "string" || typeof data.price !== "number" || typeof data.change24h !== "number") {
    return null;
  }
  const regime: LiveData["regime"] =
    data.regime === "bull" || data.regime === "bear" || data.regime === "neutral"
      ? data.regime
      : data.change24h > 0.25
        ? "bull"
        : data.change24h < -0.25
          ? "bear"
          : "neutral";
  return {
    symbol: data.symbol,
    price: data.price,
    change24h: data.change24h,
    regime,
    stale: typeof data.stale === "boolean" ? data.stale : undefined,
  };
}

export async function POST(req: Request) {
  const sessionResult = await requireGameSession();
  if (sessionResult instanceof NextResponse) return sessionResult;
  const { sessionId: id, session } = sessionResult;

  const limited = enforceGameRateLimit(req, {
    route: "game.question-ai",
    sessionId: id,
    ipMax: 30,
    sessionMax: 12,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const parsed = await parseJsonBody<{ bossIndex?: unknown; liveData?: unknown; oracleSymbol?: unknown }>(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed;

  const bossIndex = body.bossIndex === undefined ? 0 : normalizeBossIndex(body.bossIndex);
  if (bossIndex === null) {
    return jsonApiError("boss_index_invalid", 400);
  }

  let providedLiveData: LiveData | null = null;
  /** Set when the server fetched Hermes (multi-feed); omitted when the client sent liveData. */
  let serverOracleMeta: {
    intendedComparisonWindow: string;
    effectiveComparisonWindow: string;
    windowLabelHuman: string;
    quizSymbol: string;
    returnOverWindowPct: number;
  } | null = null;

  /**
   * Lazy-load AI generation services only after session + payload validation.
   * This trims work on early 4xx exits (missing session, bad JSON, invalid bossIndex/liveData).
   */
  const { generateAiQuestionForBoss, oracleFeedToLiveData } = await import("@/lib/game/question-ai-service");
  if (body.liveData === undefined) {
    const oracle = await fetchGameOracleSnapshot();
    if (!oracle) {
      logApiError("api/game/question-ai", new Error("live_snapshot_unavailable"), {
        sessionId: id,
        reason: "oracle_null",
      });
      return jsonApiError("live_snapshot_unavailable", 503, {
        message: LIVE_ORACLE_UNAVAILABLE_MESSAGE,
      });
    }
    const picked = pickOracleFeedForAdHocQuestion(oracle, normalizeOracleSymbol(body.oracleSymbol));
    if (!picked.ok) {
      if (picked.reason === "insufficient_feeds") {
        logApiError("api/game/question-ai", new Error("live_snapshot_unavailable"), {
          sessionId: id,
          reason: "insufficient_feeds",
          withReturn: oracle.feedsWithReturn.length,
        });
        return jsonApiError("live_snapshot_unavailable", 503, {
          message: LIVE_ORACLE_UNAVAILABLE_MESSAGE,
        });
      }
      return jsonApiError("oracle_symbol_not_found", 400);
    }
    providedLiveData = oracleFeedToLiveData(picked.feed);
    serverOracleMeta = {
      intendedComparisonWindow: oracle.intendedComparisonWindow,
      effectiveComparisonWindow: picked.feed.effectiveComparisonWindow,
      windowLabelHuman: oracle.windowLabelHuman,
      quizSymbol: picked.feed.quizSymbol,
      returnOverWindowPct: picked.feed.returnOverWindowPct,
    };
  } else {
    providedLiveData = normalizeLiveData(body.liveData);
    if (!providedLiveData) {
      return jsonApiError("live_data_invalid", 400);
    }
  }

  const generated = await generateAiQuestionForBoss({
    bossIndex,
    mixState: session.aiQuestionMix,
    recentSeedFactIds: session.aiRecentSeedFactIds,
    liveData: providedLiveData,
    idPrefix: "adhoc",
  });
  const nextSession = {
    ...session,
    aiQuestionMix: generated.nextMixState,
    aiRecentSeedFactIds: generated.nextRecentSeedFactIds,
  };
  const casResult = await writeSessionWithCasRetry(id, session, () => nextSession);
  const persisted = casResult.persisted;

  return NextResponse.json({
    question: {
      type: generated.question.type,
      stem: generated.question.stem,
      options: generated.question.options,
      correctIndex: generated.question.correctIndex,
      answerBool: generated.question.answerBool,
    },
    source: generated.question.source,
    sourceMode: generated.question.sourceMode,
    providerUsed: generated.meta.providerUsed,
    fallbackReason: generated.meta.fallbackReason,
    persisted,
    /**
     * When the server pulled Hermes: which window/symbol grounded `liveData` (note: `change24h` in prompts
     * is actually percent return over this comparison window, not calendar 24h).
     */
    oracleContext: serverOracleMeta,
  });
}

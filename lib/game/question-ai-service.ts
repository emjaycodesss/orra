import {
  chooseAiSourceMode,
  incrementAiMix,
  type AiMixState,
  type AiQuestionSourceMode,
} from "./question-ai-policy";
import {
  nextRecentSeedFactIds,
  pickSeedFactForBoss,
} from "./questions/seed-facts";
import type { GameOracleSnapshot, OracleFeedSnapshot } from "./pyth-hermes-snapshot";
import { gameOracleFeedsForAi, humanWindowLabel } from "./pyth-hermes-snapshot";
import {
  validateAiQuestion,
  validateLiveTfNumericConsistency,
  validateMcqNumericReturnOption,
} from "./question-ai-validator";
import { parseHermesParsedPrice } from "./hermes-parsed-price";
import type { PreparedGameQuestion } from "./types";

const GITHUB_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const HERMES_LATEST_URL = "https://hermes.pyth.network/v2/updates/price/latest";
const HERMES_PRICE_AT_TIME_URL = "https://hermes.pyth.network/v2/updates/price";
const BTC_HERMES_ID = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";

function resolveBluesmindsChatUrl(): string {
  const base = process.env.BLUESMINDS_BASE_URL?.replace(/\/$/, "");
  if (!base) return "https://api.bluesminds.com/v1/chat/completions";
  return base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

export interface LiveData {
  symbol: string;
  price: number;
  /** Percent return over the effective comparison window (not calendar 24h unless window is 1d). */
  change24h: number;
  regime: "bull" | "bear" | "neutral";
  /** When derived from Hermes — included in LLM payload for freshness-aware copy. */
  stale?: boolean;
}

/** Map multi-feed oracle row to the shape validators expect (change24h = window return %). */
export function oracleFeedToLiveData(feed: OracleFeedSnapshot): LiveData {
  const ch = feed.returnOverWindowPct;
  const regime: LiveData["regime"] =
    ch > 0.25 ? "bull" : ch < -0.25 ? "bear" : "neutral";
  return {
    symbol: feed.quizSymbol,
    price: feed.price,
    change24h: ch,
    regime,
    stale: feed.stale,
  };
}

type AiQuestion =
  | { type: "mcq"; stem: string; options: string[]; correctIndex: number }
  | { type: "tf"; stem: string; answerBool: boolean };

type ProviderName = "github-models" | "bluesminds" | "openrouter";

interface AiGenerationMeta {
  providerUsed: ProviderName | "fallback";
  fallbackReason: string | null;
}

const QUESTION_TYPE_MAP: Record<number, string> = {
  0: "Trend Analyst — onboarding, pull oracle mechanics, community basics",
  1: "Market Structure — assets, RWA, FX/indices, benchmarks, cross-chain delivery",
  2: "Liquidation Quant — Lazer, Entropy V2, aggregation logic, hardcore tech",
};

const BOSS_BRIEF_MAP: Record<number, string> = {
  0: "Use beginner-friendly onboarding concepts: pull oracle mechanics, publisher model, how prices update, and core network mission.",
  1: "Use intermediate market concepts: benchmarks, RWA/FX/indices, stale handling, and cross-chain delivery.",
  2: "Use advanced infra concepts: Entropy V2, Lazer latency/thresholds, aggregation robustness, feed IDs, and publisher-quality logic.",
};

const SYSTEM_PROMPT = `You are the Oracle Intelligence for a trivia game.
Generate exactly one question as strict JSON only.

Global rules:
- Obey requested questionType exactly ("mcq" or "tf").
- Obey requested sourceMode exactly ("seed" or "live").
- Keep content factual, concise, and game-ready.
- Never put bossTheme, bossBrief, or "Oracle check (...)" prefixes in stem or options.
- Do not ask about confidence intervals, confidence %, or publisher disagreement — use price level, direction, return over the window, and stale when relevant.
- No markdown. No prose outside JSON.

Output schema:
- For MCQ:
  {"type":"mcq","stem":"...","options":["...","...","...","..."],"correctIndex":0}
- For TF:
  {"type":"tf","stem":"...","answerBool":true}`;

function buildQuestionPromptInput(params: {
  bossIndex: number;
  sourceMode: AiQuestionSourceMode;
  questionType: "mcq" | "tf";
  seedFact: string;
  liveData: LiveData;
}): string {
  const bossTheme = QUESTION_TYPE_MAP[params.bossIndex] ?? QUESTION_TYPE_MAP[0];
  const bossBrief = BOSS_BRIEF_MAP[params.bossIndex] ?? BOSS_BRIEF_MAP[0];
  /** LLM payload: no regime label — validators use numeric return vs stem/answer. */
  const livePayload = {
    symbol: params.liveData.symbol,
    price: params.liveData.price,
    percentChangeOverContextWindow: params.liveData.change24h,
    stale: params.liveData.stale ?? false,
  };
  return JSON.stringify({
    task: "Generate one trivia question.",
    bossIndex: params.bossIndex,
    bossTheme,
    bossBrief,
    sourceMode: params.sourceMode,
    questionType: params.questionType,
    seedFact: params.seedFact,
    liveData: livePayload,
    sourcePolicy:
      params.sourceMode === "seed"
        ? "Seed fact must be primary. Live data may be supportive context only."
        : "Live data must be primary. Seed fact may be supportive context only.",
    qualityBar: [
      "No repeated stock phrasing.",
      "Distractors must be plausible but clearly wrong.",
      "Question should be answerable from provided context.",
    ],
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPythLiveDataSnapshot(): Promise<LiveData | null> {
  try {
    const latestParams = new URLSearchParams();
    latestParams.append("ids[]", BTC_HERMES_ID);
    latestParams.set("parsed", "true");
    const latestRes = await fetchWithTimeout(
      `${HERMES_LATEST_URL}?${latestParams.toString()}`,
      { method: "GET", headers: { Accept: "application/json" } },
      5000,
    );
    if (!latestRes.ok) return null;
    const latestJson = await latestRes.json();
    const latest = parseHermesParsedPrice(latestJson);
    if (!latest) return null;

    const publishTime24hAgo = Math.max(1, latest.publishTime - 24 * 60 * 60);
    const histParams = new URLSearchParams();
    histParams.append("ids[]", BTC_HERMES_ID);
    histParams.set("parsed", "true");
    const histRes = await fetchWithTimeout(
      `${HERMES_PRICE_AT_TIME_URL}/${publishTime24hAgo}?${histParams.toString()}`,
      { method: "GET", headers: { Accept: "application/json" } },
      5000,
    );
    let change24h = 0;
    if (histRes.ok) {
      const histJson = await histRes.json();
      const hist = parseHermesParsedPrice(histJson);
      if (hist && hist.price > 0) {
        change24h = ((latest.price - hist.price) / hist.price) * 100;
      }
    }

    const regime: LiveData["regime"] =
      change24h > 0.25 ? "bull" : change24h < -0.25 ? "bear" : "neutral";
    return {
      symbol: "BTC/USD",
      price: Number(latest.price.toFixed(2)),
      change24h: Number(change24h.toFixed(4)),
      regime,
    };
  } catch {
    return null;
  }
}

async function callProvider(
  url: string,
  apiKey: string | undefined,
  model: string,
  userContent: string,
  timeoutMs: number,
  providerName: ProviderName,
  options?: { maxTokens?: number; systemPrompt?: string },
): Promise<{ result: AiQuestion | null; reason: string | null }> {
  if (!apiKey) return { result: null, reason: `${providerName}:missing_api_key` };
  const max_tokens = options?.maxTokens ?? 256;
  const systemContent = options?.systemPrompt ?? SYSTEM_PROMPT;
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: userContent },
          ],
          temperature: 0.7,
          max_tokens,
        }),
      },
      timeoutMs,
    );
    if (!res.ok) {
      return { result: null, reason: `${providerName}:http_${res.status}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return { result: null, reason: `${providerName}:empty_response` };
    }
    const parsed = JSON.parse(raw) as Partial<AiQuestion>;
    if (parsed.type === "tf") {
      if (typeof parsed.stem !== "string" || typeof parsed.answerBool !== "boolean") {
        return { result: null, reason: `${providerName}:invalid_tf_shape` };
      }
      return { result: { type: "tf", stem: parsed.stem, answerBool: parsed.answerBool }, reason: null };
    }
    if (
      parsed.type === "mcq" &&
      typeof parsed.stem === "string" &&
      Array.isArray(parsed.options) &&
      typeof parsed.correctIndex === "number"
    ) {
      return {
        result: {
          type: "mcq",
          stem: parsed.stem,
          options: parsed.options,
          correctIndex: parsed.correctIndex,
        },
        reason: null,
      };
    }
    return { result: null, reason: `${providerName}:invalid_shape` };
  } catch {
    return { result: null, reason: `${providerName}:request_error` };
  }
}

const BATCH_SYSTEM_PROMPT_TEMPLATE = `You are the Oracle Intelligence for a trivia game.
Generate exactly __SLOT_COUNT__ trivia questions as one strict JSON object only.

Global rules:
- Output must be: {"questions":[ ... ]} with exactly __SLOT_COUNT__ items in the same order as the provided slots.
- Each item must match its slot's questionType ("mcq" or "tf").
- MCQ: {"type":"mcq","stem":"...","options":["...","...","...","..."],"correctIndex":0..3}
- TF: {"type":"tf","stem":"...","answerBool":true|false}
- Questions must be grounded in the slot's primaryFeed numbers (price, returnOverWindowPct, effectiveComparisonWindow, stale).
- For any price *return* claim, use primaryFeed.returnOverWindowPct and phrase the time window exactly as primaryFeed.humanWindowLabelEffective (never assume "past day" if the slot says "past hour").
- Do not invent percentages that contradict returnOverWindowPct sign or magnitude beyond reasonable rounding (~0.1% tolerance on tiny moves).
- NEVER put bossTheme, bossBrief, role names, or labels like "Oracle check (...)" in stem or options — player sees only natural trivia copy.
- Avoid repetitive "This is false because..." scaffolding; write four distinct MCQ voices (witty, precise, degen-friendly).
- No markdown. No prose outside JSON.

MCQ voice examples (format only):
- Planck: "Pull oracle 101: which detail matches the snapshot for {symbol}?"
- K.tizz: "Market microstructure check — {symbol} over the window: what actually lines up with the feed?"
- Chop: "Entropy arena: pick the line that survives a Hermes audit for {symbol}."`;

/** Strip legacy internal prefixes if the model copies them into stems. */
function sanitizeOracleStem(stem: string): string {
  return stem.replace(/^\s*oracle\s+check\s*\([^)]*\)\s*:\s*/i, "").trim();
}

function stripMarkdownJsonFences(raw: string): string {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence) t = fence[1]!.trim();
  return t;
}

async function callProviderRawJson(
  url: string,
  apiKey: string | undefined,
  model: string,
  userContent: string,
  timeoutMs: number,
  providerName: ProviderName,
  maxTokens: number,
  systemPrompt: string,
): Promise<{ raw: string | null; reason: string | null }> {
  if (!apiKey) return { raw: null, reason: `${providerName}:missing_api_key` };
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.55,
          max_tokens: maxTokens,
        }),
      },
      timeoutMs,
    );
    if (!res.ok) {
      return { raw: null, reason: `${providerName}:http_${res.status}` };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return { raw: null, reason: `${providerName}:empty_response` };
    }
    return { raw, reason: null };
  } catch {
    return { raw: null, reason: `${providerName}:request_error` };
  }
}

/**
 * Server-grounded return MCQ: correct option matches returnOverWindowPct; distractors are numeric lies.
 */
function buildNumericReturnMcqFromFeed(feed: OracleFeedSnapshot): Pick<
  PreparedGameQuestion,
  "type" | "stem" | "options" | "correctIndex" | "answerBool"
> {
  const period = humanWindowLabel(feed.effectiveComparisonWindow);
  const sym = feed.quizSymbol;
  const ch = feed.returnOverWindowPct;
  const bump = Math.abs(ch) < 0.5 ? 0.85 : Math.max(0.5, Math.abs(ch) * 0.55);
  const w1 = ch + bump;
  const w2 = ch - bump;
  const w3 = ch > 0 ? -(Math.abs(ch) + bump * 0.9) : Math.abs(ch) + bump * 0.9;
  const correctText = `${sym} moved about ${ch.toFixed(2)}% over ${period} versus the oracle anchor price.`;
  const rawOpts = [
    correctText,
    `${sym} moved about ${w1.toFixed(2)}% over ${period} versus the oracle anchor price.`,
    `${sym} moved about ${w2.toFixed(2)}% over ${period} versus the oracle anchor price.`,
    `${sym} was essentially flat (under 0.01% move) over ${period}.`,
  ];
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  const options = order.map((j) => rawOpts[j]!);
  const correctIndex = options.indexOf(correctText);
  return {
    type: "mcq",
    stem: `Over ${period}, which statement best matches the oracle snapshot for ${sym}?`,
    options,
    correctIndex: Math.max(0, correctIndex),
  };
}

function buildTemplateLiveQuestionFromOracleFeed(
  feed: OracleFeedSnapshot,
  _bossIndex: number,
  questionType: "mcq" | "tf",
  _snapshot: GameOracleSnapshot,
): Pick<PreparedGameQuestion, "type" | "stem" | "options" | "correctIndex" | "answerBool"> {
  const sym = feed.quizSymbol;
  const ch = feed.returnOverWindowPct;
  const direction = ch >= 0 ? "up" : "down";
  /** Must match the window used to compute returnOverWindowPct (fixes intended vs effective mismatch). */
  const period = humanWindowLabel(feed.effectiveComparisonWindow);
  if (questionType === "tf") {
    return {
      type: "tf",
      stem: `For ${sym}, over ${period}, the snapshot return is ${direction} (about ${Math.abs(ch).toFixed(2)}%). True or false?`,
      answerBool: true,
    };
  }
  return {
    type: "mcq",
    stem: `For ${sym} over ${period}, which statement matches the oracle snapshot?`,
    options: [
      `${sym} moved about ${ch.toFixed(2)}% vs the window anchor for the printed price level.`,
      `${sym} has no usable oracle return figure in this window.`,
      `${sym} is static for the full period.`,
      `${sym} cannot be read on-chain or off-chain.`,
    ],
    correctIndex: 0,
  };
}

export interface LiveQuestionSlotSpec {
  bossIndex: 0 | 1 | 2;
  questionType: "mcq" | "tf";
  feed: OracleFeedSnapshot;
}

/**
 * One batched LLM call for 12 live questions (prepare-run), with per-slot validation and template-live fallback.
 */
export async function generateBatchedLivePrepareQuestions(params: {
  snapshot: GameOracleSnapshot;
  slots: LiveQuestionSlotSpec[];
  mixState?: Partial<AiMixState>;
  idPrefix: string;
}): Promise<{
  questions: PreparedGameQuestion[];
  nextMixState: AiMixState;
  meta: AiGenerationMeta;
}> {
  const slots = params.slots;
  const N = slots.length;
  if (N !== 12) {
    throw new Error(`batched_live_expected_12_slots got ${N}`);
  }

  const systemPrompt = BATCH_SYSTEM_PROMPT_TEMPLATE.replace(/__SLOT_COUNT__/g, String(N));
  const userPayload = {
    task: `Generate ${N} trivia questions in slot order.`,
    comparisonContext: {
      intendedWindow: params.snapshot.intendedComparisonWindow,
      humanWindowLabel: params.snapshot.windowLabelHuman,
    },
    oracleFeedsSummary: gameOracleFeedsForAi(params.snapshot).map((f) => ({
      symbol: f.quizSymbol,
      price: f.price,
      publishTime: f.publishTime,
      intendedComparisonWindow: f.intendedComparisonWindow,
      effectiveComparisonWindow: f.effectiveComparisonWindow,
      returnOverWindowPct: f.returnOverWindowPct,
      stale: f.stale,
    })),
    slots: slots.map((s, order) => ({
      order,
      bossIndex: s.bossIndex,
      bossTheme: QUESTION_TYPE_MAP[s.bossIndex] ?? QUESTION_TYPE_MAP[0],
      bossBrief: BOSS_BRIEF_MAP[s.bossIndex] ?? BOSS_BRIEF_MAP[0],
      questionType: s.questionType,
      primaryFeed: {
        symbol: s.feed.quizSymbol,
        price: s.feed.price,
        publishTime: s.feed.publishTime,
        intendedComparisonWindow: s.feed.intendedComparisonWindow,
        returnOverWindowPct: s.feed.returnOverWindowPct,
        effectiveComparisonWindow: s.feed.effectiveComparisonWindow,
        stale: s.feed.stale,
        /** Use this exact phrase in any return % copy (matches computed return). */
        humanWindowLabelEffective: humanWindowLabel(s.feed.effectiveComparisonWindow),
      },
    })),
  };
  const userContent = JSON.stringify(userPayload);

  let raw: string | null = null;
  const reasons: string[] = [];
  let providerUsed: ProviderName | "fallback" = "fallback";

  const githubKey = process.env.GITHUB_TOKEN ?? process.env.GITHUB_MODELS_TOKEN;
  if (!raw && githubKey) {
    const r = await callProviderRawJson(
      GITHUB_MODELS_URL,
      githubKey,
      "gpt-4.1-mini",
      userContent,
      45000,
      "github-models",
      8192,
      systemPrompt,
    );
    raw = r.raw;
    if (r.reason) reasons.push(r.reason);
    if (raw) providerUsed = "github-models";
  }
  const bluesmindKey = process.env.BLUESMINDS_API_KEY;
  if (!raw && bluesmindKey) {
    const r = await callProviderRawJson(
      resolveBluesmindsChatUrl(),
      bluesmindKey,
      process.env.BLUESMINDS_MODEL?.trim() ?? "gpt-4.1",
      userContent,
      35000,
      "bluesminds",
      8192,
      systemPrompt,
    );
    raw = r.raw;
    if (r.reason) reasons.push(r.reason);
    if (raw) providerUsed = "bluesminds";
  }
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!raw && openRouterKey) {
    const r = await callProviderRawJson(
      OPENROUTER_URL,
      openRouterKey,
      "meta-llama/llama-3.1-8b-instruct:free",
      userContent,
      35000,
      "openrouter",
      8192,
      systemPrompt,
    );
    raw = r.raw;
    if (r.reason) reasons.push(r.reason);
    if (raw) providerUsed = "openrouter";
  }

  type ParsedSlot = Partial<AiQuestion> | null;
  let parsedQuestions: ParsedSlot[] = Array(N).fill(null);

  if (raw) {
    try {
      const stripped = stripMarkdownJsonFences(raw);
      const doc = JSON.parse(stripped) as { questions?: unknown };
      const arr = Array.isArray(doc.questions) ? doc.questions : null;
      if (arr && arr.length === N) {
        parsedQuestions = arr.map((q) => (q && typeof q === "object" ? (q as ParsedSlot) : null));
      } else {
        reasons.push("batch:questions_length_mismatch");
      }
    } catch {
      reasons.push("batch:json_parse_error");
    }
  }

  /** One repair pass: smaller model chain skipped — reuse same providers with fix instruction. */
  if (parsedQuestions.some((q) => q === null)) {
    const repairUser = `${userContent}\n\nYour previous output was invalid. Reply with ONLY valid JSON: {"questions":[...]} with exactly ${N} items, same slot order, each matching questionType.`;
    raw = null;
    if (githubKey) {
      const r = await callProviderRawJson(
        GITHUB_MODELS_URL,
        githubKey,
        "gpt-4.1-mini",
        repairUser,
        45000,
        "github-models",
        8192,
        systemPrompt,
      );
      raw = r.raw;
      if (r.reason) reasons.push(`repair:${r.reason}`);
      if (raw) providerUsed = "github-models";
    }
    if (!raw && bluesmindKey) {
      const r = await callProviderRawJson(
        resolveBluesmindsChatUrl(),
        bluesmindKey,
        process.env.BLUESMINDS_MODEL?.trim() ?? "gpt-4.1",
        repairUser,
        35000,
        "bluesminds",
        8192,
        systemPrompt,
      );
      raw = r.raw;
      if (r.reason) reasons.push(`repair:${r.reason}`);
      if (raw) providerUsed = "bluesminds";
    }
    if (!raw && openRouterKey) {
      const r = await callProviderRawJson(
        OPENROUTER_URL,
        openRouterKey,
        "meta-llama/llama-3.1-8b-instruct:free",
        repairUser,
        35000,
        "openrouter",
        8192,
        systemPrompt,
      );
      raw = r.raw;
      if (r.reason) reasons.push(`repair:${r.reason}`);
      if (raw) providerUsed = "openrouter";
    }
    if (raw) {
      try {
        const stripped = stripMarkdownJsonFences(raw);
        const doc = JSON.parse(stripped) as { questions?: unknown };
        const arr = Array.isArray(doc.questions) ? doc.questions : null;
        if (arr && arr.length === N) {
          parsedQuestions = arr.map((q) => (q && typeof q === "object" ? (q as ParsedSlot) : null));
        }
      } catch {
        reasons.push("repair:json_parse_error");
      }
    }
  }

  let mixState: AiMixState = {
    seed: Number.isFinite(params.mixState?.seed) ? Number(params.mixState?.seed) : 0,
    live: Number.isFinite(params.mixState?.live) ? Number(params.mixState?.live) : 0,
  };

  const out: PreparedGameQuestion[] = [];
  let anyTemplate = false;

  for (let i = 0; i < N; i++) {
    const slot = slots[i]!;
    const liveData = oracleFeedToLiveData(slot.feed);
    const pq = parsedQuestions[i];
    let aiShape: AiQuestion | null = null;

    if (pq?.type === "tf" && typeof pq.stem === "string" && typeof pq.answerBool === "boolean") {
      const stem = sanitizeOracleStem(pq.stem);
      aiShape = { type: "tf", stem, answerBool: pq.answerBool };
    } else if (
      pq?.type === "mcq" &&
      typeof pq.stem === "string" &&
      Array.isArray(pq.options) &&
      typeof pq.correctIndex === "number"
    ) {
      aiShape = {
        type: "mcq",
        stem: sanitizeOracleStem(pq.stem),
        options: pq.options.map((o: string) => sanitizeOracleStem(String(o))),
        correctIndex: pq.correctIndex,
      };
    }

    if (aiShape && aiShape.type !== slot.questionType) {
      aiShape = null;
      reasons.push(`batch:slot_${i}_type_mismatch`);
    }

    if (aiShape?.type === "mcq") {
      if (!validateAiQuestion(aiShape, liveData)) {
        reasons.push(`batch:slot_${i}_validation_failed`);
        aiShape = null;
      } else if (!validateMcqNumericReturnOption(aiShape, liveData)) {
        reasons.push(`batch:slot_${i}_numeric_mcq_failed`);
        aiShape = null;
      }
    }

    if (aiShape?.type === "tf" && !validateLiveTfNumericConsistency(aiShape.stem, aiShape.answerBool, liveData)) {
      reasons.push(`batch:slot_${i}_numeric_tf_failed`);
      aiShape = null;
    }

    let final: Pick<
      PreparedGameQuestion,
      "type" | "stem" | "options" | "correctIndex" | "answerBool"
    >;
    let source: PreparedGameQuestion["source"];
    if (aiShape) {
      final = aiShape;
      source = "ai";
    } else if (slot.questionType === "mcq") {
      final = buildNumericReturnMcqFromFeed(slot.feed);
      source = "template-live";
      anyTemplate = true;
    } else {
      final = buildTemplateLiveQuestionFromOracleFeed(slot.feed, slot.bossIndex, slot.questionType, params.snapshot);
      source = "template-live";
      anyTemplate = true;
    }

    mixState = incrementAiMix(mixState, "live");

    const generatedId = `${params.idPrefix}_live_${i}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    out.push({
      id: generatedId,
      bossIndex: slot.bossIndex,
      type: final.type,
      stem: final.stem,
      options: final.type === "mcq" ? (final.options ?? []).slice(0, 4) : undefined,
      correctIndex: final.type === "mcq" ? Math.max(0, Math.min(3, final.correctIndex ?? 0)) : undefined,
      answerBool: final.type === "tf" ? Boolean(final.answerBool) : undefined,
      sourceMode: "live",
      source,
      oracleProvenance: {
        quizSymbol: slot.feed.quizSymbol,
        returnOverWindowPct: slot.feed.returnOverWindowPct,
        effectiveComparisonWindow: slot.feed.effectiveComparisonWindow,
        publishTime: slot.feed.publishTime,
      },
    });
  }

  return {
    questions: out,
    nextMixState: mixState,
    meta: {
      providerUsed: anyTemplate ? "fallback" : providerUsed,
      fallbackReason: anyTemplate ? reasons.join("|") || "batch_partial_template" : null,
    },
  };
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function buildSeedFactsFallbackQuestion(
  fact: string,
  _bossIndex: number,
  _seedFactId: string | null,
  sourceMode: AiQuestionSourceMode,
  questionType: "mcq" | "tf",
  liveData: LiveData,
): Pick<PreparedGameQuestion, "type" | "stem" | "options" | "correctIndex" | "answerBool"> {
  if (sourceMode === "live") {
    if (questionType === "tf") {
      const direction = liveData.change24h >= 0 ? "up" : "down";
      return {
        type: "tf",
        stem: `Live feed check — ${liveData.symbol} is ${direction} about ${Math.abs(liveData.change24h).toFixed(4)}% over the context window. True or false?`,
        answerBool: true,
      };
    }
    return {
      type: "mcq",
      stem: `Based on live data, which statement is accurate for ${liveData.symbol}?`,
      options: [
        `${liveData.symbol} moved ${liveData.change24h}% over the context window versus the oracle anchor.`,
        `${liveData.symbol} has no usable return figure for that window in this snapshot.`,
        `${liveData.symbol} live data can only be used off-chain.`,
        `${liveData.symbol} price feeds are static and do not update over time.`,
      ],
      correctIndex: 0,
    };
  }

  if (questionType === "tf") {
    return {
      type: "tf",
      stem: `${fact} True or false?`,
      answerBool: true,
    };
  }

  return {
    type: "mcq",
    stem: `${fact} Which option is accurate?`,
    options: [
      "Yes — that matches how Pyth is documented to work.",
      "No — Pyth only ever publishes a single static price with no updates.",
      "No — Pyth feeds cannot be verified or attributed to publishers.",
      "No — Pyth prices are decorative and never used by on-chain consumers.",
    ],
    correctIndex: 0,
  };
}

export async function generateAiQuestionForBoss(params: {
  bossIndex: number;
  mixState?: Partial<AiMixState>;
  recentSeedFactIds?: string[];
  liveData?: LiveData;
  idPrefix?: string;
  forceSourceMode?: AiQuestionSourceMode;
  forceQuestionType?: "mcq" | "tf";
}): Promise<{
  question: PreparedGameQuestion;
  nextMixState: AiMixState;
  nextRecentSeedFactIds: string[];
  meta: AiGenerationMeta;
}> {
  const { bossIndex, mixState, recentSeedFactIds } = params;
  const liveData: LiveData | null = params.liveData ?? (await fetchPythLiveDataSnapshot());
  if (!liveData) {
    throw new Error("live_snapshot_unavailable");
  }

  const sourceMode: AiQuestionSourceMode = chooseAiSourceMode(mixState);
  const effectiveSourceMode = params.forceSourceMode ?? sourceMode;
  const selectedSeed = pickSeedFactForBoss(bossIndex, recentSeedFactIds ?? []);
  const selectedSeedFact =
    selectedSeed?.fact ?? "Pyth Network provides real-time price feeds for DeFi protocols.";

  const forcedType = params.forceQuestionType;
  const requestedQuestionType: "mcq" | "tf" =
    forcedType ?? (hashString(selectedSeed?.id ?? selectedSeedFact) % 2 === 0 ? "tf" : "mcq");

  const userContent = buildQuestionPromptInput({
    bossIndex,
    sourceMode: effectiveSourceMode,
    questionType: requestedQuestionType,
    seedFact: selectedSeedFact,
    liveData,
  });

  let result: AiQuestion | null = null;
  let providerUsed: ProviderName | "fallback" = "fallback";
  const reasons: string[] = [];
  const githubKey = process.env.GITHUB_TOKEN ?? process.env.GITHUB_MODELS_TOKEN;
  if (!result) {
    const github = await callProvider(
      GITHUB_MODELS_URL,
      githubKey,
      "gpt-4.1-mini",
      userContent,
      6000,
      "github-models",
    );
    result = github.result;
    if (github.reason) reasons.push(github.reason);
    if (result) providerUsed = "github-models";
  }
  const bluesmindKey = process.env.BLUESMINDS_API_KEY;
  if (!result && bluesmindKey) {
    const bluesminds = await callProvider(
      resolveBluesmindsChatUrl(),
      bluesmindKey,
      process.env.BLUESMINDS_MODEL?.trim() ?? "gpt-4.1",
      userContent,
      5000,
      "bluesminds",
    );
    result = bluesminds.result;
    if (bluesminds.reason) reasons.push(bluesminds.reason);
    if (result) providerUsed = "bluesminds";
  }
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!result && openRouterKey) {
    const openrouter = await callProvider(
      OPENROUTER_URL,
      openRouterKey,
      "meta-llama/llama-3.1-8b-instruct:free",
      userContent,
      5000,
      "openrouter",
    );
    result = openrouter.result;
    if (openrouter.reason) reasons.push(openrouter.reason);
    if (result) providerUsed = "openrouter";
  }

  if (result?.type === "tf") {
    result = { ...result, stem: sanitizeOracleStem(result.stem) };
  }
  if (result?.type === "mcq") {
    result = {
      ...result,
      stem: sanitizeOracleStem(result.stem),
      options: result.options.map((o) => sanitizeOracleStem(o)),
    };
  }
  if (result?.type === "mcq" && !validateAiQuestion(result, liveData)) {
    reasons.push(`${providerUsed}:validation_failed`);
    result = null;
    providerUsed = "fallback";
  }
  if (result?.type === "mcq" && !validateMcqNumericReturnOption(result, liveData)) {
    reasons.push(`${providerUsed}:numeric_mcq_failed`);
    result = null;
    providerUsed = "fallback";
  }
  if (
    result?.type === "tf" &&
    !validateLiveTfNumericConsistency(result.stem, result.answerBool, liveData)
  ) {
    reasons.push(`${providerUsed}:numeric_tf_failed`);
    result = null;
    providerUsed = "fallback";
  }

  const final = result
    ? result
    : buildSeedFactsFallbackQuestion(
        selectedSeedFact,
        bossIndex,
        selectedSeed?.id ?? null,
        effectiveSourceMode,
        requestedQuestionType,
        liveData,
      );
  const source = result ? "ai" : "seed-facts-fallback";

  const idPrefix = params.idPrefix ?? "pre";
  const generatedId = `${idPrefix}_b${bossIndex}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const question: PreparedGameQuestion = {
    id: generatedId,
    bossIndex: bossIndex as 0 | 1 | 2,
    type: final.type,
    stem: final.stem,
    options: final.type === "mcq" ? (final.options ?? []).slice(0, 4) : undefined,
    correctIndex:
      final.type === "mcq" ? Math.max(0, Math.min(3, final.correctIndex ?? 0)) : undefined,
    answerBool: final.type === "tf" ? Boolean(final.answerBool) : undefined,
    sourceMode: effectiveSourceMode,
    source,
  };

  return {
    question,
    nextMixState: incrementAiMix(mixState, effectiveSourceMode),
    nextRecentSeedFactIds: selectedSeed
      ? nextRecentSeedFactIds(recentSeedFactIds, selectedSeed.id)
      : recentSeedFactIds ?? [],
    meta: {
      providerUsed,
      fallbackReason: source === "seed-facts-fallback" ? reasons.join("|") || "provider_unavailable" : null,
    },
  };
}

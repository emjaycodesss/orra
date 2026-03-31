import { NextResponse } from "next/server";
import {
  INTERPRETATION_UNAVAILABLE,
  excerptProviderError,
  shouldAttemptFallback,
} from "@/lib/interpret-provider-errors";
import {
  INTERPRET_MAX_BODY_BYTES,
  validateInterpretBody,
  type InterpretChatPayload,
} from "@/lib/interpret-request-validator";
import {
  allowInterpretRateLimit,
  isInterpretOriginAllowed,
} from "@/lib/interpret-route-guards";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GITHUB_MODELS_URL = "https://models.inference.ai.azure.com/chat/completions";

const GITHUB_MODELS: string[] = process.env.GITHUB_MODELS_MODEL?.trim()
  ? [process.env.GITHUB_MODELS_MODEL.trim()]
  : ["gpt-4.1-mini", "gpt-4.1"];

function resolveBluesmindsChatUrl(): string {
  const override = process.env.BLUESMINDS_CHAT_URL?.trim();
  if (override) return override;
  const base = process.env.BLUESMINDS_BASE_URL?.replace(/\/$/, "");
  if (!base) return "https://api.bluesminds.com/v1/chat/completions";
  return base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

const BLUESMINDS_MODELS: string[] = process.env.BLUESMINDS_MODEL?.trim()
  ? [process.env.BLUESMINDS_MODEL.trim()]
  : ["gpt-4.1"];

const TIMEOUT_MS = 25_000;
const GITHUB_TIMEOUT_MS = 15_000;
const BLUESMINDS_TIMEOUT_MS = 8_000;
const OPENROUTER_TIMEOUT_MS = 10_000;

/** Upstream error snippets only in dev — avoids leaking provider messages in production. */
const EXPOSE_INTERPRET_DETAILS = process.env.NODE_ENV === "development";

function openRouterFallbackModels(): string[] {
  const multi = process.env.OPENROUTER_FALLBACK_MODELS?.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  if (multi?.length) return multi;
  const single = process.env.OPENROUTER_FALLBACK_MODEL?.trim();
  const defaults = [
    "meta-llama/llama-3.1-8b-instruct:free",
    "google/gemma-2-9b-it:free",
    "qwen/qwen-2.5-7b-instruct:free",
  ];
  if (single) return [single, ...defaults.filter((m) => m !== single)];
  return defaults;
}

function withModel(body: InterpretChatPayload, model: string): InterpretChatPayload & { model: string } {
  return { ...body, model };
}

function interpretErrorResponse(status: number, rawBody: string, provider: string) {
  const details = excerptProviderError(rawBody);
  if (process.env.NODE_ENV === "development") {
    console.warn(`[interpret] ${provider} failed`, status, details || rawBody.slice(0, 120));
  }
  return NextResponse.json(
    {
      error: INTERPRETATION_UNAVAILABLE,
      ...(EXPOSE_INTERPRET_DETAILS && details ? { details } : {}),
      provider,
    },
    { status }
  );
}

export async function POST(request: Request) {
  if (!isInterpretOriginAllowed(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!allowInterpretRateLimit(request)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const githubToken = process.env.GITHUB_MODELS_TOKEN;
  const bluesmindsKey = process.env.BLUESMINDS_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!githubToken && !bluesmindsKey && !openrouterKey) {
    return NextResponse.json(
      {
        error:
          "Interpretation is not configured. Add GITHUB_MODELS_TOKEN, BLUESMINDS_API_KEY, or OPENROUTER_API_KEY.",
      },
      { status: 500 }
    );
  }

  let rawText: string;
  try {
    rawText = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (rawText.length > INTERPRET_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = rawText.length ? JSON.parse(rawText) : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateInterpretBody(parsed);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: validated.status });
  }

  const body = validated.payload;

  let failureChain = "";

  async function callProvider(
    url: string,
    apiKey: string,
    payload: InterpretChatPayload & { model: string },
    extraHeaders: Record<string, string> = {},
    timeoutMs = TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...extraHeaders,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  if (githubToken) {
    for (const model of GITHUB_MODELS) {
      try {
        const res = await callProvider(GITHUB_MODELS_URL, githubToken, withModel(body, model), {}, GITHUB_TIMEOUT_MS);
        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content ?? "";
          return NextResponse.json({ interpretation: content, provider: "github-models", model });
        }
        const text = await res.text();
        console.warn(`[interpret] GitHub Models model=${model} status=${res.status} body=${text.slice(0, 300)}`);
        const excerpt = excerptProviderError(text) || text.slice(0, 180);
        failureChain = failureChain ? `${failureChain}; GitHub(${model}): ${excerpt}` : `GitHub(${model}): ${excerpt}`;
        if (!shouldAttemptFallback(res.status, text)) break;
      } catch (e) {
        const excerpt = e instanceof Error && e.name === "AbortError" ? "timed out" : String(e).slice(0, 120);
        failureChain = failureChain ? `${failureChain}; GitHub(${model}): ${excerpt}` : `GitHub(${model}): ${excerpt}`;
        break;
      }
    }
  }

  if (bluesmindsKey) {
    for (const model of BLUESMINDS_MODELS) {
      try {
        const res = await callProvider(
          resolveBluesmindsChatUrl(),
          bluesmindsKey,
          withModel(body, model),
          {},
          BLUESMINDS_TIMEOUT_MS
        );
        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content ?? "";
          return NextResponse.json({ interpretation: content, provider: "bluesminds", model });
        }
        const text = await res.text();
        console.warn(`[interpret] Bluesminds model=${model} status=${res.status} body=${text.slice(0, 300)}`);
        const excerpt = excerptProviderError(text) || text.slice(0, 180);
        failureChain = failureChain ? `${failureChain}; Bluesminds(${model}): ${excerpt}` : `Bluesminds(${model}): ${excerpt}`;
        if (!shouldAttemptFallback(res.status, text)) break;
      } catch (e) {
        const excerpt = e instanceof Error && e.name === "AbortError" ? "timed out" : String(e).slice(0, 120);
        failureChain = failureChain ? `${failureChain}; Bluesminds(${model}): ${excerpt}` : `Bluesminds(${model}): ${excerpt}`;
        break;
      }
    }
  }

  if (openrouterKey) {
    const models = openRouterFallbackModels();
    for (const model of models) {
      try {
        const res = await callProvider(
          OPENROUTER_URL,
          openrouterKey,
          withModel(body, model),
          {
            "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "https://orra.oracle",
            "X-Title": process.env.OPENROUTER_APP_TITLE ?? "Orra",
          },
          OPENROUTER_TIMEOUT_MS
        );
        const text = await res.text();
        if (res.ok) {
          let data: { choices?: Array<{ message?: { content?: string } }> };
          try {
            data = JSON.parse(text) as typeof data;
          } catch {
            continue;
          }
          const content = data.choices?.[0]?.message?.content ?? "";
          return NextResponse.json({ interpretation: content, provider: "openrouter", model });
        }
        const excerpt = excerptProviderError(text) || text.slice(0, 180);
        failureChain = failureChain ? `${failureChain}; OR(${model}): ${excerpt}` : `OR(${model}): ${excerpt}`;
      } catch (e) {
        const excerpt = e instanceof Error && e.name === "AbortError" ? "timed out" : String(e).slice(0, 120);
        failureChain = failureChain ? `${failureChain}; OR(${model}): ${excerpt}` : `OR(${model}): ${excerpt}`;
      }
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.warn("[interpret] all providers failed:", failureChain);
  }

  return NextResponse.json(
    {
      error: INTERPRETATION_UNAVAILABLE,
      ...(EXPOSE_INTERPRET_DETAILS && failureChain ? { details: failureChain } : {}),
    },
    { status: 502 }
  );
}

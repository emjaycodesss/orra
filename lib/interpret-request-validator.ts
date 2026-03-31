export const INTERPRET_MAX_BODY_BYTES = 64 * 1024;

const ALLOWED_TOP_LEVEL_KEYS = new Set(["model", "max_tokens", "messages"]);

// Aligns with buildMessages(); caps provider spend.
const MAX_TOKENS_CAP = 384;

const MAX_CONTENT_PER_MESSAGE = 24_000;

const MAX_MESSAGES = 8;

export type InterpretChatPayload = {
  max_tokens: number;
  messages: Array<{ role: "system" | "user"; content: string }>;
};

export type ValidateInterpretBodyResult =
  | { ok: true; payload: InterpretChatPayload }
  | { ok: false; error: string; status: number };

export function validateInterpretBody(raw: unknown): ValidateInterpretBodyResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Body must be a JSON object", status: 400 };
  }

  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return { ok: false, error: "Unsupported fields in request body", status: 400 };
    }
  }

  if (!Array.isArray(obj.messages)) {
    return { ok: false, error: "messages must be an array", status: 400 };
  }

  if (obj.messages.length === 0 || obj.messages.length > MAX_MESSAGES) {
    return { ok: false, error: "messages length invalid", status: 400 };
  }

  const messages: InterpretChatPayload["messages"] = [];
  for (const entry of obj.messages) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, error: "invalid message shape", status: 400 };
    }
    const m = entry as { role?: unknown; content?: unknown };
    if (m.role !== "system" && m.role !== "user") {
      return { ok: false, error: "invalid message role", status: 400 };
    }
    if (typeof m.content !== "string") {
      return { ok: false, error: "message content must be a string", status: 400 };
    }
    if (m.content.length > MAX_CONTENT_PER_MESSAGE) {
      return { ok: false, error: "message too long", status: 400 };
    }
    messages.push({ role: m.role, content: m.content });
  }

  let max_tokens = 250;
  if (obj.max_tokens !== undefined) {
    if (
      typeof obj.max_tokens !== "number" ||
      !Number.isFinite(obj.max_tokens) ||
      obj.max_tokens < 1
    ) {
      return { ok: false, error: "max_tokens invalid", status: 400 };
    }
    max_tokens = Math.min(Math.floor(obj.max_tokens), MAX_TOKENS_CAP);
  }

  return { ok: true, payload: { max_tokens, messages } };
}

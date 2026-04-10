import { devWarn } from "@/lib/dev-warn";

export const INTERPRETATION_UNAVAILABLE =
  "We couldn’t generate your interpretation right now. Try again in a moment.";

export function excerptProviderError(raw: string, max = 220): string {
  const s = raw.trim();
  if (!s) return "";
  try {
    const j = JSON.parse(s) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const inner = j?.error;
    const msg =
      typeof inner === "object" && inner?.message
        ? inner.message
        : typeof inner === "string"
          ? inner
          : typeof j?.message === "string"
            ? j.message
            : "";
    if (msg.trim()) return msg.length > max ? `${msg.slice(0, max)}…` : msg;
  } catch (e) {
    devWarn("interpret:excerpt-json", e);
  }
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function shouldAttemptFallback(status: number, body: string): boolean {
  if (status === 422) return false;
  const lower = body.toLowerCase();
  if (status === 400 || status === 404) {
    return (
      lower.includes("model") ||
      lower.includes("not found") ||
      lower.includes("unknown") ||
      lower.includes("does not exist") ||
      lower.includes("invalid model") ||
      lower.includes("no such model")
    );
  }
  return true;
}

import { describe, expect, it } from "vitest";
import { validateInterpretBody } from "./interpret-request-validator";

describe("validateInterpretBody", () => {
  it("accepts valid system+user messages and default max_tokens", () => {
    const r = validateInterpretBody({
      model: "ignored-by-server",
      max_tokens: 250,
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.max_tokens).toBe(250);
      expect(r.payload.messages).toHaveLength(2);
    }
  });

  it("rejects extra top-level keys", () => {
    const r = validateInterpretBody({
      messages: [{ role: "user", content: "x" }],
      temperature: 0.7,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("caps max_tokens at 384", () => {
    const r = validateInterpretBody({
      messages: [{ role: "user", content: "x" }],
      max_tokens: 9999,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.max_tokens).toBe(384);
  });

  it("rejects assistant role", () => {
    const r = validateInterpretBody({
      messages: [{ role: "assistant", content: "nope" } as { role: string; content: string }],
    });
    expect(r.ok).toBe(false);
  });
});

import { NextResponse } from "next/server";
import { isGameDatabaseEnabled } from "@/lib/db/env";
import { withRlsContext } from "@/lib/db/with-rls-context";
import { logApiError } from "@/lib/api-observability";

/**
 * Debug endpoint to test database connectivity and RLS context.
 * Development only — production returns 404 so the path is not enumerable (403 would confirm it exists).
 * POST /api/game/debug-db with body: { session_id: "test-123" }
 * Errors: stack traces stay in logs (`logApiError`); JSON includes message only.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!isGameDatabaseEnabled()) {
    return NextResponse.json({ error: "database not configured (ORRA_DATABASE_URL or DATABASE_URL not set)" }, { status: 503 });
  }

  let body: { session_id?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "session_id required in body" }, { status: 400 });
  }

  try {
    const result = await withRlsContext({ session_id: sessionId }, async (client) => {
      const r = await client.query("SELECT current_setting('orra.session_id') as session_id, now() as timestamp");
      return r.rows[0];
    });

    return NextResponse.json({
      success: true,
      message: "Database connection and RLS context working",
      rlsContext: result,
    });
  } catch (err) {
    logApiError("api/game/debug-db", err, { sessionId });
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

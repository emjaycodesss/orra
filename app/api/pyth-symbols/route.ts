import { NextResponse } from "next/server";

const SYMBOLS_API =
  "https://history.pyth-lazer.dourolabs.app/history/v1/symbols";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";

  const res = await fetch(`${SYMBOLS_API}?query=${encodeURIComponent(query)}`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch symbols" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}

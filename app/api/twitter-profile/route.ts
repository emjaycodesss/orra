import { NextResponse } from "next/server";
import { logApiError } from "@/lib/api-observability";
import { normalizeAvatarUrl } from "@/lib/avatar-url";

const TWEETIQ = "https://tweetiq.onrender.com/api/analyze/profile";
const SYNDICATION = "https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=";

async function fetchSyndicationProfile(raw: string) {
  try {
    const res = await fetch(`${SYNDICATION}${encodeURIComponent(raw)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    if (!res.ok) {
      return null;
    }
    let data: Array<{
      name?: string;
      screen_name?: string;
      profile_image_url?: string;
      profile_image_url_https?: string;
    }> = [];
    try {
      const rawBody = await res.text();
      if (!rawBody.trim()) {
        return null;
      }
      data = JSON.parse(rawBody) as typeof data;
    } catch (parseErr) {
      return null;
    }
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) {
      return null;
    }
    const name = entry.name?.trim() || `@${raw}`;
    const picRaw = entry.profile_image_url_https?.trim() || entry.profile_image_url?.trim() || null;
    const pic = normalizeAvatarUrl(picRaw);
    return { name, pic };
  } catch (err) {
    logApiError("api/twitter-profile/syndication", err, { handle: raw });
    return null;
  }
}

export async function POST(req: Request) {
  let body: { username?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = (body.username ?? "").trim().replace(/^@+/, "");
  if (!raw || raw.length > 32 || !/^[A-Za-z0-9_]+$/.test(raw)) {
    return NextResponse.json({ error: "username" }, { status: 400 });
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25_000);
    const res = await fetch(TWEETIQ, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: raw }),
      signal: ctrl.signal,
    });
    clearTimeout(t);

    if (res.ok) {
      const j = (await res.json()) as Record<string, unknown>;

      const profile = typeof j.profile === "object" && j.profile !== null ? (j.profile as Record<string, unknown>) : j;

      const name =
        (typeof profile.name === "string" && profile.name) ||
        (typeof profile.displayName === "string" && profile.displayName) ||
        (typeof profile.username === "string" && profile.username) ||
        `@${raw}`;
      const picRaw =
        (typeof profile.profileImageUrl === "string" && profile.profileImageUrl) ||
        (typeof profile.profileImageUrl400 === "string" && profile.profileImageUrl400) ||
        (typeof profile.profile_image_url_https === "string" && profile.profile_image_url_https) ||
        (typeof profile.profile_image_url === "string" && profile.profile_image_url) ||
        (typeof profile.avatar === "string" && profile.avatar) ||
        null;
      const pic = normalizeAvatarUrl(picRaw);
      return NextResponse.json({
        fallback: false,
        handle: `@${raw}`,
        displayName: String(name),
        avatarUrl: pic,
      });
    }
    const fallback = await fetchSyndicationProfile(raw);
    if (fallback) {
      return NextResponse.json({
        fallback: false,
        handle: `@${raw}`,
        displayName: fallback.name,
        avatarUrl: fallback.pic,
      });
    }
    return NextResponse.json({
      fallback: true,
      handle: `@${raw}`,
      displayName: `@${raw}`,
      avatarUrl: null as string | null,
    });
  } catch {
    const fallback = await fetchSyndicationProfile(raw);
    if (fallback) {
      return NextResponse.json({
        fallback: false,
        handle: `@${raw}`,
        displayName: fallback.name,
        avatarUrl: fallback.pic,
      });
    }
    return NextResponse.json({
      fallback: true,
      handle: `@${raw}`,
      displayName: `@${raw}`,
      avatarUrl: null as string | null,
    });
  }
}

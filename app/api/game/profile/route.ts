import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logApiError } from "@/lib/api-observability";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { readSessionFile, writeSessionFile, writeSessionFileIfRevision } from "@/lib/game/fs-store";
import { GAME_SESSION_COOKIE, stripSecretAnswers } from "@/lib/game/http-session";

const TWEETIQ = "https://tweetiq.onrender.com/api/analyze/profile";
const SYNDICATION = "https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=";

/**
 * Lazy-load profile persistence to avoid paying DB module startup costs
 * on routes that only need session updates.
 * `user_profiles.twitter_handle` is NOT NULL — skip the write if we have no handle.
 */
async function saveUserProfileLazy(
  walletAddress: string,
  twitterHandle: string | null | undefined,
  displayName: string | null,
  avatarUrl: string | null,
): Promise<void> {
  const handle = typeof twitterHandle === "string" ? twitterHandle.trim() : "";
  if (!handle) return;
  const { saveUserProfile } = await import("@/lib/db/user-profiles");
  await saveUserProfile(walletAddress, handle, displayName, avatarUrl);
}

async function fetchSyndicationProfile(raw: string) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000); // 5 second timeout
    const res = await fetch(`${SYNDICATION}${encodeURIComponent(raw)}`, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
    clearTimeout(t);

    if (!res.ok) {
      return null;
    }

    let data;
    try {
      const text = await res.text();
      if (!text.trim()) {
        return null;
      }
      data = JSON.parse(text) as Array<{
        name?: string;
        screen_name?: string;
        profile_image_url?: string;
        profile_image_url_https?: string;
      }>;
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
    logApiError("api/game/profile/syndication", err, { handle: raw });
    return null;
  }
}

/**
 * Save X handle on session + `user_profiles`. Syndication is synchronous; TweetIQ enriches in background
 * with re-read + revision-safe writes. Immediate DB upsert lets a new cookie show the handle before TweetIQ returns.
 */
export async function POST(req: Request) {
  const jar = await cookies();
  const id = jar.get(GAME_SESSION_COOKIE)?.value;
  if (!id) {
    return NextResponse.json({ error: "no_session" }, { status: 401 });
  }
  const session = await readSessionFile(id);
  if (!session) {
    return NextResponse.json({ error: "expired" }, { status: 401 });
  }

  let body: { username?: string; walletAddress?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const raw = (body.username ?? "").trim().replace(/^@+/, "");
  if (!raw || raw.length > 32 || !/^[A-Za-z0-9_]+$/.test(raw)) {
    return NextResponse.json({ error: "username" }, { status: 400 });
  }

  let displayName: string | null = null;
  let avatarUrl: string | null = null;

  const walletFromBody =
    typeof body.walletAddress === "string" && body.walletAddress.startsWith("0x")
      ? body.walletAddress
      : null;

  const syndication = await fetchSyndicationProfile(raw);
  if (syndication) {
    displayName = syndication.name;
    avatarUrl = syndication.pic;
  } else {
    displayName = `@${raw}`;
  }

  const next = {
    ...session,
    walletAddress: walletFromBody || session.walletAddress,
    twitterHandle: `@${raw}`,
    displayName: displayName ?? `@${raw}`,
    avatarUrl,
  };

  void (async () => {
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

        const tweetiqName =
          (typeof profile.name === "string" && profile.name) ||
          (typeof profile.displayName === "string" && profile.displayName) ||
          (typeof profile.username === "string" && profile.username);
        const tweetiqPicRaw =
          (typeof profile.profileImageUrl === "string" && profile.profileImageUrl) ||
          (typeof profile.profileImageUrl400 === "string" && profile.profileImageUrl400) ||
          (typeof profile.profile_image_url_https === "string" && profile.profile_image_url_https) ||
          (typeof profile.profile_image_url === "string" && profile.profile_image_url) ||
          (typeof profile.avatar === "string" && profile.avatar) ||
          null;
        const tweetiqPic = normalizeAvatarUrl(tweetiqPicRaw);

        if (tweetiqName || tweetiqPic) {
          const latest = await readSessionFile(id);
          if (!latest) return;
          const updated = {
            ...latest,
            walletAddress: walletFromBody || latest.walletAddress,
            twitterHandle: `@${raw}`,
            displayName: tweetiqName || displayName || `@${raw}`,
            avatarUrl: tweetiqPic || avatarUrl,
          };
          const expectedRevision = latest.revision ?? 0;
          const wrote = await writeSessionFileIfRevision(id, updated, expectedRevision);
          if (!wrote) return;
          const wallet = walletFromBody || latest.walletAddress;
          if (wallet) {
            try {
              await saveUserProfileLazy(wallet, `@${raw}`, updated.displayName, updated.avatarUrl);
            } catch {
              /* best-effort profile upsert */
            }
          }
        } else {
          const latest = await readSessionFile(id);
          const wallet = walletFromBody || latest?.walletAddress || session.walletAddress;
          if (wallet) {
            try {
              await saveUserProfileLazy(wallet, `@${raw}`, next.displayName, next.avatarUrl);
            } catch {
              /* best-effort profile upsert */
            }
          }
        }
      } else {
        const latest = await readSessionFile(id);
        const wallet = walletFromBody || latest?.walletAddress || session.walletAddress;
        if (wallet) {
          try {
            await saveUserProfileLazy(wallet, `@${raw}`, next.displayName, next.avatarUrl);
          } catch {
            /* best-effort profile upsert */
          }
        }
      }
    } catch {
      try {
        const latest = await readSessionFile(id);
        const wallet = walletFromBody || latest?.walletAddress || session.walletAddress;
        if (wallet) {
          try {
            await saveUserProfileLazy(wallet, `@${raw}`, next.displayName, next.avatarUrl);
          } catch {
            /* best-effort profile upsert */
          }
        }
      } catch {
        /* session file already written on fast path */
      }
    }
  })();

  try {
    await writeSessionFile(id, next);
  } catch (err) {
    throw err;
  }

  if (next.walletAddress?.startsWith("0x") && next.twitterHandle) {
    try {
      await saveUserProfileLazy(
        next.walletAddress,
        next.twitterHandle,
        next.displayName,
        next.avatarUrl,
      );
    } catch {
      /* optional DB in dev; background TweetIQ task may still upsert */
    }
  }

  return NextResponse.json({ session: stripSecretAnswers(next), fallback: !avatarUrl });
}

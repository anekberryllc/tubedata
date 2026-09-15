/**
 * YouTube URL parsing + metadata fetching.
 * Ported from the yt-spike script — parser is unchanged and still passes its 17 cases.
 */

const API = "https://www.googleapis.com/youtube/v3/videos";

// Everything a plain API key can request. Costs 1 quota unit regardless of count.
const PARTS = [
  "snippet", "contentDetails", "statistics", "status",
  "topicDetails", "player", "recordingDetails",
  "liveStreamingDetails", "localizations",
].join(",");

const valid = (id?: string | null) =>
  id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;

/** Pull the 11-char video ID out of any YouTube URL shape. */
export function extractVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;

  let u: URL;
  try { u = new URL(s.startsWith("http") ? s : `https://${s}`); }
  catch { return null; }

  const host = u.hostname.replace(/^www\.|^m\./, "");
  const seg = u.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return valid(seg[0]);
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    if (u.searchParams.has("v")) return valid(u.searchParams.get("v"));
    if (["shorts", "embed", "live", "v"].includes(seg[0])) return valid(seg[1]);
  }
  return null;
}

/** ISO-8601 duration (PT4M13S) -> seconds */
export function parseDuration(iso?: string): number | null {
  if (!iso) return null;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [d, h, mi, s] = m.slice(1).map(x => (x ? Number(x) : 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}

export function formatDuration(total: number | null): string {
  if (total === null) return "?";
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export type Thumbnail = { url: string; width?: number; height?: number };
export type ThumbnailSet = Record<string, Thumbnail>;

export type VideoMetadata = {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  durationSeconds: number | null;
  duration: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  tags: string[];
  topics: string[];
  hasCaptions: boolean;
  definition: string;
  categoryId: string;
  language: string | null;
  privacyStatus: string;
  madeForKids: boolean;
  embeddable: boolean;
  licensedContent: boolean;
  /** Best available image, shown to everyone as the hero. */
  thumbnail: string | null;
  /** Every resolution with direct URLs — premium only. */
  thumbnails: ThumbnailSet;
  regionRestriction: unknown;
  raw: unknown;
};

/**
 * Why a call failed in a way that says something about the KEY rather than the
 * video. The pool in youtube-pool.ts rotates on these; nothing else reads them.
 *
 *   quota   — this key's daily allowance is gone. Try the next key; Google
 *             resets it at Pacific midnight.
 *   invalid — the key itself was refused: revoked, mistyped, or restricted to
 *             referrers/IPs that do not include this server. Another key may
 *             still work, but this one needs a human.
 *
 * DELIBERATELY NOT INCLUDED: rateLimitExceeded and userRateLimitExceeded.
 * Those are short-term throttles, not the daily cap — treating them as
 * exhaustion would retire a perfectly good key for the rest of the day over a
 * burst that would have cleared in a second.
 */
export type KeyFailure = "quota" | "invalid";

export type FetchResult =
  | { ok: true; data: VideoMetadata }
  | {
      ok: false;
      reason: "bad_url" | "not_found" | "api_error";
      message: string;
      /** Present only when the KEY is the problem. See KeyFailure. */
      keyFailure?: KeyFailure;
    };

type GoogleError = {
  error?: {
    message?: string;
    errors?: { reason?: string }[];
    details?: { reason?: string }[];
  };
};

/**
 * Work out whether a refusal is about the KEY, and which kind.
 *
 * GOOGLE SAYS IT IN TWO PLACES AND THEY DISAGREE. For a bad API key the old
 * `error.errors[0].reason` is "badRequest" — useless, it could mean anything —
 * while `error.details[].reason` (the newer ErrorInfo block) says
 * "API_KEY_INVALID". Reading only the first one is why an invalid key was
 * originally returned to the visitor instead of rotating past. Both are read
 * here, and the precise one wins.
 *
 * rateLimitExceeded and userRateLimitExceeded are deliberately left
 * unclassified. They are per-second throttles, not the daily cap; treating one
 * as exhaustion would retire a healthy key for the rest of the day over a
 * burst that would have cleared immediately.
 */
function classifyKeyFailure(body: unknown): KeyFailure | undefined {
  const err = (body as GoogleError)?.error;

  const legacy = err?.errors?.[0]?.reason ?? "";
  const precise = (err?.details ?? []).map((d) => d?.reason ?? "");

  if (legacy === "quotaExceeded" || legacy === "dailyLimitExceeded") return "quota";

  // Every API_KEY_* ErrorInfo is a key problem: invalid, blocked for this
  // service, or blocked by a referrer/IP restriction that does not include
  // this server. All of them mean "try another key and flag this one".
  if (precise.some((r) => r.startsWith("API_KEY_")) || precise.includes("SERVICE_DISABLED")) {
    return "invalid";
  }

  if (legacy === "keyInvalid" || legacy === "keyExpired" || legacy === "accessNotConfigured") {
    return "invalid";
  }

  return undefined;
}

/** Google's own message, which is usually the most useful thing to show. */
function errorMessage(body: unknown): string {
  return (body as GoogleError)?.error?.message ?? "";
}

const toNum = (x?: string) => (x === undefined ? null : Number(x));

/**
 * One call to YouTube with ONE key.
 *
 * The key is a parameter rather than read from the environment here, and that
 * is load-bearing: this module is reachable from client components (page.tsx
 * imports VideoMetadata from it), so it must not grow a database import to go
 * and find a key. Choosing which key to spend lives in youtube-pool.ts, on the
 * server side of that line, and hands the answer down.
 */
export async function fetchVideoMetadata(input: string, key: string): Promise<FetchResult> {
  const videoId = extractVideoId(input);
  if (!videoId) {
    return { ok: false, reason: "bad_url", message: "That doesn't look like a YouTube URL." };
  }

  if (!key) {
    return { ok: false, reason: "api_error", message: "No YouTube API key is configured." };
  }

  const res = await fetch(`${API}?part=${PARTS}&id=${videoId}&key=${key}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    // The body is where Google says WHY, and the difference between "this key
    // is spent" and "this key is wrong" decides whether the pool moves on
    // quietly or flags the key for a person. A failed response is small, so
    // parsing it costs nothing; guard it anyway in case it is not JSON.
    const body = await res.json().catch(() => null);
    const detail = errorMessage(body);
    const keyFailure = classifyKeyFailure(body);

    return {
      ok: false,
      reason: "api_error",
      message: detail || `YouTube API returned ${res.status}.`,
      ...(keyFailure ? { keyFailure } : {}),
    };
  }

  const json = await res.json();

  // Empty array (not an error) means private, deleted, or nonexistent.
  if (!json.items?.length) {
    return {
      ok: false,
      reason: "not_found",
      message: "No video found — it may be private, deleted, or the ID is wrong.",
    };
  }

  const v = json.items[0];
  const sn = v.snippet ?? {};
  const st = v.statistics ?? {};
  const cd = v.contentDetails ?? {};
  const sts = v.status ?? {};
  const secs = parseDuration(cd.duration);

  return {
    ok: true,
    data: {
      videoId,
      title: sn.title ?? "(no title)",
      description: sn.description ?? "",
      channelTitle: sn.channelTitle ?? "",
      channelId: sn.channelId ?? "",
      publishedAt: sn.publishedAt ?? "",
      durationSeconds: secs,
      duration: formatDuration(secs),
      viewCount: toNum(st.viewCount),
      likeCount: toNum(st.likeCount),
      commentCount: toNum(st.commentCount),
      tags: sn.tags ?? [],
      topics: (v.topicDetails?.topicCategories ?? []).map(
        (t: string) => t.split("/").pop()!.replace(/_/g, " ")
      ),
      hasCaptions: cd.caption === "true",
      definition: (cd.definition ?? "").toUpperCase(),
      categoryId: sn.categoryId ?? "",
      language: sn.defaultAudioLanguage ?? sn.defaultLanguage ?? null,
      privacyStatus: sts.privacyStatus ?? "",
      madeForKids: !!sts.madeForKids,
      embeddable: !!sts.embeddable,
      licensedContent: !!cd.licensedContent,
      thumbnail:
        sn.thumbnails?.maxres?.url ?? sn.thumbnails?.high?.url ?? sn.thumbnails?.default?.url ?? null,
      thumbnails: (sn.thumbnails ?? {}) as ThumbnailSet,
      regionRestriction: cd.regionRestriction ?? null,
      raw: v,
    },
  };
}

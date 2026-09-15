import { parseDuration } from "./youtube";
import type { ThumbnailSet } from "./youtube";

/**
 * Channel lookup.
 *
 * THREE QUOTA UNITS, FIXED, whatever the channel's size:
 *
 *   1. channels.list          — the channel, and its uploads playlist id
 *   2. playlistItems.list     — the most recent RECENT_VIDEOS ids
 *   3. videos.list            — statistics for those ids, 50 per unit
 *
 * `search.list` is never used and must not be: it costs 100 units, which is one
 * percent of the daily allowance for a single channel, and everything it would
 * give us here is reachable for one. The uploads playlist is the documented
 * cheap route and it is why this feature is affordable at all.
 *
 * Takes the API key as an argument for the same reason fetchVideoMetadata does:
 * choosing a key is a database question and this module must stay importable
 * without dragging drizzle in behind it. See youtube-pool.ts.
 */

const API = "https://www.googleapis.com/youtube/v3";

/**
 * How many recent uploads to analyse.
 *
 * Fifty because that is exactly one page of playlistItems AND one page of
 * videos.list — 51 would double the cost of both. It is also enough to say
 * something honest about cadence and typical performance without reaching so
 * far back that a channel's old format drowns out what it does now.
 */
export const RECENT_VIDEOS = 50;

/** A YouTube channel id. Always starts UC and is 24 characters. */
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

export type ChannelRef =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "username"; value: string };

/**
 * Work out what a pasted string refers to, without spending anything.
 *
 * LEGACY /c/ VANITY URLS ARE DELIBERATELY UNSUPPORTED. There is no cheap API
 * that resolves them — the only route is search.list at 100 units, and burning
 * one percent of the day's quota to look up a name is not a trade worth making
 * silently. The caller tells the visitor to paste the @handle instead, which is
 * on the same page they copied the URL from.
 */
export function parseChannelRef(input: string): ChannelRef | null {
  const s = input.trim();
  if (!s) return null;

  if (CHANNEL_ID.test(s)) return { kind: "id", value: s };
  if (s.startsWith("@") && s.length > 1) return { kind: "handle", value: s };

  let url: URL;
  try {
    url = new URL(s.includes("://") ? s : `https://${s}`);
  } catch {
    return null;
  }

  if (!/(^|\.)youtube\.com$/.test(url.hostname) && url.hostname !== "youtu.be") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  // /@handle, possibly with /videos or /featured after it
  if (parts[0].startsWith("@")) return { kind: "handle", value: parts[0] };

  if (parts[0] === "channel" && parts[1] && CHANNEL_ID.test(parts[1])) {
    return { kind: "id", value: parts[1] };
  }

  if (parts[0] === "user" && parts[1]) return { kind: "username", value: parts[1] };

  // A watch URL identifies a video, not a channel — the caller has a better
  // error for that than "not found".
  return null;
}

export type ChannelVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
  durationSeconds: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  /**
   * COUNT AND LENGTH ONLY, never the tags or description themselves. The audit
   * needs to know whether a video is missing them; shipping fifty full
   * descriptions to the browser to answer a yes/no question would bloat the
   * payload for nothing. Anyone wanting the actual tags looks the video up.
   */
  tagCount: number;
  descriptionLength: number;
};

export type ChannelData = {
  channelId: string;
  title: string;
  description: string;
  customUrl: string | null;
  country: string | null;
  publishedAt: string;
  thumbnails: ThumbnailSet;
  subscriberCount: number | null;
  /** True when the channel hides its subscriber count; the number is then 0. */
  subscribersHidden: boolean;
  viewCount: number | null;
  videoCount: number | null;
  /** Channel-level keywords — hidden from viewers, same as video tags. */
  keywords: string[];
  topics: string[];
  madeForKids: boolean;
  recent: ChannelVideo[];
};

export type ChannelResult =
  | { ok: true; data: ChannelData; quotaUnits: number }
  | {
      ok: false;
      reason: "bad_url" | "not_found" | "api_error" | "unsupported_url";
      message: string;
      keyFailure?: "quota" | "invalid";
    };

const num = (x?: string) => (x === undefined ? null : Number(x));

/**
 * Channel keywords arrive as ONE space-separated string, with quotes around any
 * keyword containing a space: `mrbeast "mr beast" challenge`. Splitting on
 * whitespace alone would shred the quoted ones into nonsense.
 */
export function parseChannelKeywords(raw?: string): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const value = (m[1] ?? m[2] ?? "").trim();
    if (value) out.push(value);
  }
  return out;
}

export async function fetchChannel(input: string, key: string): Promise<ChannelResult> {
  const ref = parseChannelRef(input);

  if (!ref) {
    // Distinguish the two failures a visitor can actually cause, because the
    // fixes are different: a /c/ URL needs a different URL, a random string
    // needs a different input entirely.
    if (/youtube\.com\/c\//i.test(input)) {
      return {
        ok: false,
        reason: "unsupported_url",
        message:
          "Old /c/ channel URLs can't be looked up cheaply. Open the channel and copy " +
          "its @handle from the header, or use the /channel/UC… URL.",
      };
    }
    return {
      ok: false,
      reason: "bad_url",
      message: "Paste a channel URL or @handle — for example youtube.com/@mkbhd.",
    };
  }

  const param =
    ref.kind === "id"
      ? `id=${ref.value}`
      : ref.kind === "handle"
        ? `forHandle=${encodeURIComponent(ref.value)}`
        : `forUsername=${encodeURIComponent(ref.value)}`;

  const parts = "snippet,statistics,contentDetails,brandingSettings,topicDetails,status";
  const chRes = await fetch(`${API}/channels?part=${parts}&${param}&key=${key}`, {
    cache: "no-store",
  });

  if (!chRes.ok) return apiFailure(chRes);

  const chJson = await chRes.json();
  const ch = chJson.items?.[0];
  if (!ch) {
    return {
      ok: false,
      reason: "not_found",
      message: "No channel found — check the handle or URL.",
    };
  }

  const uploads: string | undefined = ch.contentDetails?.relatedPlaylists?.uploads;
  let recent: ChannelVideo[] = [];
  let units = 1;

  // A channel with no uploads playlist (or none at all) is not an error — it is
  // a channel with nothing in it, and the rest of the record is still useful.
  if (uploads) {
    const plRes = await fetch(
      `${API}/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=${RECENT_VIDEOS}&key=${key}`,
      { cache: "no-store" }
    );
    units += 1;

    if (plRes.ok) {
      const plJson = await plRes.json();
      const ids: string[] = (plJson.items ?? [])
        .map((i: { contentDetails?: { videoId?: string } }) => i.contentDetails?.videoId)
        .filter(Boolean);

      if (ids.length) {
        const vRes = await fetch(
          `${API}/videos?part=snippet,statistics,contentDetails&id=${ids.join(",")}&key=${key}`,
          { cache: "no-store" }
        );
        units += 1;

        if (vRes.ok) {
          const vJson = await vRes.json();
          recent = (vJson.items ?? []).map(
            (v: {
              id: string;
              snippet?: {
                title?: string;
                publishedAt?: string;
                tags?: string[];
                description?: string;
              };
              statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
              contentDetails?: { duration?: string };
            }) => ({
              videoId: v.id,
              title: v.snippet?.title ?? "(no title)",
              publishedAt: v.snippet?.publishedAt ?? "",
              durationSeconds: parseDuration(v.contentDetails?.duration),
              viewCount: num(v.statistics?.viewCount),
              likeCount: num(v.statistics?.likeCount),
              commentCount: num(v.statistics?.commentCount),
              tagCount: v.snippet?.tags?.length ?? 0,
              descriptionLength: (v.snippet?.description ?? "").trim().length,
            })
          );
        }
      }
    }
  }

  return {
    ok: true,
    quotaUnits: units,
    data: {
      channelId: ch.id,
      title: ch.snippet?.title ?? "(no title)",
      description: ch.snippet?.description ?? "",
      customUrl: ch.snippet?.customUrl ?? null,
      country: ch.snippet?.country ?? null,
      publishedAt: ch.snippet?.publishedAt ?? "",
      thumbnails: (ch.snippet?.thumbnails ?? {}) as ThumbnailSet,
      subscriberCount: num(ch.statistics?.subscriberCount),
      subscribersHidden: !!ch.statistics?.hiddenSubscriberCount,
      viewCount: num(ch.statistics?.viewCount),
      videoCount: num(ch.statistics?.videoCount),
      keywords: parseChannelKeywords(ch.brandingSettings?.channel?.keywords),
      topics: (ch.topicDetails?.topicCategories ?? []).map((t: string) =>
        t.split("/").pop()!.replace(/_/g, " ")
      ),
      madeForKids: !!ch.status?.madeForKids,
      recent,
    },
  };
}

/** Same key-failure classification the video path uses, so the pool can rotate. */
async function apiFailure(res: Response): Promise<ChannelResult> {
  const body = await res.json().catch(() => null);
  const err = (body as { error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } })?.error;
  const legacy = err?.errors?.[0]?.reason ?? "";
  const precise = (err?.details ?? []).map((d) => d?.reason ?? "");

  const keyFailure =
    legacy === "quotaExceeded" || legacy === "dailyLimitExceeded"
      ? ("quota" as const)
      : precise.some((r) => r.startsWith("API_KEY_")) || legacy === "keyInvalid"
        ? ("invalid" as const)
        : undefined;

  return {
    ok: false,
    reason: "api_error",
    message: err?.message ?? `YouTube API returned ${res.status}.`,
    ...(keyFailure ? { keyFailure } : {}),
  };
}

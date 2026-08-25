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

export type FetchResult =
  | { ok: true; data: VideoMetadata }
  | { ok: false; reason: "bad_url" | "not_found" | "api_error"; message: string };

const toNum = (x?: string) => (x === undefined ? null : Number(x));

export async function fetchVideoMetadata(input: string): Promise<FetchResult> {
  const videoId = extractVideoId(input);
  if (!videoId) {
    return { ok: false, reason: "bad_url", message: "That doesn't look like a YouTube URL." };
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return { ok: false, reason: "api_error", message: "Server is missing YOUTUBE_API_KEY." };
  }

  const res = await fetch(`${API}?part=${PARTS}&id=${videoId}&key=${key}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return { ok: false, reason: "api_error", message: `YouTube API returned ${res.status}.` };
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

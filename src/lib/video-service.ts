import { eq, desc } from "drizzle-orm";
import { db, videos, videoStats, lookups } from "@/db";
import { extractVideoId, fetchVideoMetadata, formatDuration, type VideoMetadata } from "./youtube";

/** How long cached metadata stays fresh before we refetch. */
const METADATA_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export type LookupResult =
  | { ok: true; data: VideoMetadata; cacheHit: boolean; quotaUnits: number; statsHistory: StatPoint[] }
  | { ok: false; reason: string; message: string };

export type StatPoint = {
  capturedAt: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
};

/** Reassemble the API-shaped object from a cached row. */
function fromRow(row: typeof videos.$inferSelect, latest?: typeof videoStats.$inferSelect): VideoMetadata {
  return {
    videoId: row.videoId,
    title: row.title ?? "",
    description: row.description ?? "",
    channelTitle: row.channelTitle ?? "",
    channelId: row.channelId ?? "",
    publishedAt: row.publishedAt?.toISOString() ?? "",
    durationSeconds: row.durationSeconds,
    duration: formatDuration(row.durationSeconds),
    viewCount: latest?.viewCount ?? null,
    likeCount: latest?.likeCount ?? null,
    commentCount: latest?.commentCount ?? null,
    tags: row.tags ?? [],
    topics: row.topics ?? [],
    hasCaptions: !!row.hasCaptions,
    definition: row.definition ?? "",
    categoryId: row.categoryId ?? "",
    language: row.language,
    privacyStatus: row.privacyStatus ?? "",
    madeForKids: !!row.madeForKids,
    embeddable: !!row.embeddable,
    licensedContent: !!row.licensedContent,
    thumbnail: row.thumbnail,
    // Full resolution set isn't a column — pull it back out of the stored raw response.
    thumbnails:
      ((row.raw as { snippet?: { thumbnails?: unknown } } | null)?.snippet?.thumbnails ??
        {}) as VideoMetadata["thumbnails"],
    regionRestriction: row.regionRestriction,
    raw: row.raw,
  };
}

async function history(videoId: string): Promise<StatPoint[]> {
  const rows = await db
    .select()
    .from(videoStats)
    .where(eq(videoStats.videoId, videoId))
    .orderBy(desc(videoStats.capturedAt))
    .limit(50);

  return rows
    .map(r => ({
      capturedAt: r.capturedAt.toISOString(),
      viewCount: r.viewCount,
      likeCount: r.likeCount,
      commentCount: r.commentCount,
    }))
    .reverse();
}

export async function lookupVideo(
  sourceUrl: string,
  ipAddress?: string,
  /**
   * Signed-in user, if any. Recorded for EVERY signed-in user including free
   * ones — viewing the history is gated, collecting it is not, so an upgrade
   * reveals a real backlog instead of an empty page.
   */
  userId?: string | null,
  /**
   * When false, no row is written to `lookups`.
   *
   * Used for an immediate repeat of the same URL: the daily allowance counts
   * rows in this table, so not writing one is exactly what makes the repeat
   * free — and it also keeps the "last lookup" pointer on the original, so a
   * third and fourth refresh stay free too.
   */
  record = true,
): Promise<LookupResult> {
  const videoId = extractVideoId(sourceUrl);
  if (!videoId) {
    return { ok: false, reason: "bad_url", message: "That doesn't look like a YouTube URL." };
  }

  const [cached] = await db.select().from(videos).where(eq(videos.videoId, videoId)).limit(1);

  // Negative results are cached too — a dead URL shouldn't cost a quota unit every time.
  if (cached && cached.status !== "available") {
    if (record) await db.insert(lookups).values({ videoId, sourceUrl, cacheHit: true, quotaUnits: 0, ipAddress, userId });
    return { ok: false, reason: cached.status, message: "No video found — it may be private, deleted, or the ID is wrong." };
  }

  const fresh = cached && Date.now() - cached.fetchedAt.getTime() < METADATA_TTL_MS;

  if (cached && fresh) {
    const [latest] = await db
      .select().from(videoStats)
      .where(eq(videoStats.videoId, videoId))
      .orderBy(desc(videoStats.capturedAt)).limit(1);

    if (record) await db.insert(lookups).values({ videoId, sourceUrl, cacheHit: true, quotaUnits: 0, ipAddress, userId });
    return { ok: true, data: fromRow(cached, latest), cacheHit: true, quotaUnits: 0, statsHistory: await history(videoId) };
  }

  // No cache-only fallback here any more: the daily cap counts every lookup,
  // cached or not, and the API route rejects over-limit callers before this
  // function is reached.

  // Cache miss or stale — spend the quota unit.
  const result = await fetchVideoMetadata(sourceUrl);

  if (!result.ok) {
    if (result.reason === "not_found") {
      await db.insert(videos)
        .values({ videoId, status: "not_found", fetchedAt: new Date() })
        .onConflictDoUpdate({ target: videos.videoId, set: { status: "not_found", fetchedAt: new Date() } });
    }
    if (record) await db.insert(lookups).values({ videoId, sourceUrl, cacheHit: false, quotaUnits: 1, ipAddress, userId });
    return result;
  }

  const d = result.data;
  const now = new Date();

  const row = {
    videoId: d.videoId,
    channelId: d.channelId,
    channelTitle: d.channelTitle,
    title: d.title,
    description: d.description,
    tags: d.tags,
    topics: d.topics,
    publishedAt: d.publishedAt ? new Date(d.publishedAt) : null,
    durationSeconds: d.durationSeconds,
    hasCaptions: d.hasCaptions,
    definition: d.definition,
    categoryId: d.categoryId,
    language: d.language,
    privacyStatus: d.privacyStatus,
    madeForKids: d.madeForKids,
    embeddable: d.embeddable,
    licensedContent: d.licensedContent,
    thumbnail: d.thumbnail,
    regionRestriction: d.regionRestriction as object | null,
    raw: d.raw as object,
    status: "available",
    fetchedAt: now,
  };

  await db.insert(videos).values(row)
    .onConflictDoUpdate({ target: videos.videoId, set: row });

  // Append a stats snapshot — never an update. This accumulates the history.
  await db.insert(videoStats).values({
    videoId: d.videoId,
    capturedAt: now,
    viewCount: d.viewCount,
    likeCount: d.likeCount,
    commentCount: d.commentCount,
  }).onConflictDoNothing();

  if (record) await db.insert(lookups).values({ videoId, sourceUrl, cacheHit: false, quotaUnits: 1, ipAddress, userId });

  return { ok: true, data: d, cacheHit: false, quotaUnits: 1, statsHistory: await history(d.videoId) };
}

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, lookups, videos } from "@/db";

export type HistoryEntry = {
  videoId: string;
  sourceUrl: string;
  title: string | null;
  channelTitle: string | null;
  thumbnail: string | null;
  durationSeconds: number | null;
  status: string;
  lastViewedAt: Date;
  timesViewed: number;
};

/**
 * A signed-in user's lookup history, newest first.
 *
 * Grouped by video rather than listed raw: looking the same video up six times
 * is one row that says "6×", not six rows burying everything else.
 */
export async function getLookupHistory(
  userId: string,
  limit = 100
): Promise<HistoryEntry[]> {
  const rows = await db
    .select({
      videoId: lookups.videoId,
      sourceUrl: sql<string>`MAX(${lookups.sourceUrl})`,
      lastViewedAt: sql<Date>`MAX(${lookups.requestedAt})`,
      timesViewed: sql<number>`COUNT(*)::int`,
      title: videos.title,
      channelTitle: videos.channelTitle,
      thumbnail: videos.thumbnail,
      durationSeconds: videos.durationSeconds,
      status: sql<string>`COALESCE(${videos.status}, 'unknown')`,
    })
    .from(lookups)
    .leftJoin(videos, eq(videos.videoId, lookups.videoId))
    .where(and(eq(lookups.userId, userId), isNotNull(lookups.videoId)))
    .groupBy(
      lookups.videoId,
      videos.title,
      videos.channelTitle,
      videos.thumbnail,
      videos.durationSeconds,
      videos.status
    )
    .orderBy(desc(sql`MAX(${lookups.requestedAt})`))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    videoId: r.videoId as string,
    lastViewedAt: new Date(r.lastViewedAt),
  }));
}

/**
 * How many distinct videos this user has looked up. Powers the locked teaser
 * for free users — "43 videos saved" is a far better upgrade prompt than a
 * generic pitch, and it is true data they already generated.
 */
export async function getHistoryCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(DISTINCT ${lookups.videoId})::int` })
    .from(lookups)
    .where(and(eq(lookups.userId, userId), isNotNull(lookups.videoId)));

  return row?.n ?? 0;
}

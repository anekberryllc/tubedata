import { and, desc, eq, sql } from "drizzle-orm";
import { db, users, lookups, videos } from "@/db";
import { looseSearch } from "./search";

/**
 * The raw lookups table, searchable — every request the site has served,
 * signed in or anonymous.
 *
 * This is deliberately NOT lib/lookup-history.ts. That one groups by video and
 * answers "what has this user looked at"; this one is the ledger, one row per
 * request, and answers "what happened, when, and from where". An admin
 * investigating abuse needs the repeats, the timestamps and the IPs that the
 * grouped view throws away.
 *
 * It exposes IP addresses, which is why every entry point guards on admin
 * before calling it.
 */

export type AdminLookup = {
  id: number;
  requestedAt: Date;
  videoId: string | null;
  sourceUrl: string;
  cacheHit: boolean;
  quotaUnits: number;
  ipAddress: string | null;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  title: string | null;
  channelTitle: string | null;
  thumbnail: string | null;
  status: string | null;
};

export type LookupSearch = {
  rows: AdminLookup[];
  total: number;
  page: number;
  pages: number;
  perPage: number;
};

export const LOOKUPS_PER_PAGE = 50;

/**
 * One search box over six columns — video id, source URL, IP, video title,
 * channel and the user's email — because an admin arriving here has a single
 * string and does not yet know which of those it is.
 */
export async function searchLookups({
  q,
  userId,
  page = 1,
  perPage = LOOKUPS_PER_PAGE,
}: {
  q?: string;
  userId?: string;
  page?: number;
  perPage?: number;
}): Promise<LookupSearch> {
  const term = q?.trim();

  const filters = [
    userId ? eq(lookups.userId, userId) : undefined,
    term
      ? looseSearch(term, [
          lookups.videoId,
          lookups.sourceUrl,
          lookups.ipAddress,
          videos.title,
          videos.channelTitle,
          users.email,
        ])
      : undefined,
  ].filter((f) => f !== undefined);

  const where = filters.length ? and(...filters) : undefined;

  // Counted with the same joins as the page query, because the search terms
  // reach into `videos` and `user` — counting `lookups` alone would report a
  // total the rows below could never add up to.
  const [counted] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(lookups)
    .leftJoin(videos, eq(videos.videoId, lookups.videoId))
    .leftJoin(users, eq(users.id, lookups.userId))
    .where(where);

  const total = counted?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pages);

  const rows = await db
    .select({
      id: lookups.id,
      requestedAt: lookups.requestedAt,
      videoId: lookups.videoId,
      sourceUrl: lookups.sourceUrl,
      cacheHit: lookups.cacheHit,
      quotaUnits: lookups.quotaUnits,
      ipAddress: lookups.ipAddress,
      userId: lookups.userId,
      userEmail: users.email,
      userName: users.name,
      title: videos.title,
      channelTitle: videos.channelTitle,
      thumbnail: videos.thumbnail,
      status: videos.status,
    })
    .from(lookups)
    .leftJoin(videos, eq(videos.videoId, lookups.videoId))
    .leftJoin(users, eq(users.id, lookups.userId))
    .where(where)
    // id breaks ties: two lookups can share a timestamp, and a page boundary
    // landing between them would otherwise repeat or skip a row.
    .orderBy(desc(lookups.requestedAt), desc(lookups.id))
    .limit(perPage)
    .offset((current - 1) * perPage);

  return { rows, total, page: current, pages, perPage };
}

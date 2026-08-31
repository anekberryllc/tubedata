import { and, desc, eq, gt, gte, sql as raw } from "drizzle-orm";
import { db, lookups } from "@/db";
import { isAdmin } from "./roles";
import {
  FREE_DAILY_LOOKUPS,
  PRO_MONTHLY_LOOKUPS,
  type LimitPeriod,
} from "./limits";

/**
 * Volume limiting, backed by the `lookups` table we already write to.
 *
 * THREE CEILINGS, and they are counted over different things:
 *
 *   free   FREE_DAILY_LOOKUPS per IP, rolling 24 hours. Per IP because a free
 *          visitor need not have an account at all.
 *   Pro    PRO_MONTHLY_LOOKUPS per ACCOUNT, per calendar month. Per account
 *          because it is what the subscription bought — it must not evaporate
 *          because they opened a laptop on a different network, and it must
 *          not multiply because they opened a phone.
 *   admin  none. Staff operate the site rather than buy it.
 *
 * Every lookup counts, cache hits included. That is deliberate even though a
 * cache hit costs no YouTube quota: an allowance a visitor can predict beats
 * one that only counts cache misses, which would make popular videos free and
 * obscure ones not, with no visible reason why.
 *
 * PRO WAS UNLIMITED UNTIL 2026-08-31. The consequence worth remembering is
 * that a paying subscriber can now hit a wall, so every caller has to handle
 * a 429 for someone who has already paid — there is no upgrade to sell them,
 * only prepaid packs and a reset date.
 */
export { FREE_DAILY_LOOKUPS as DAILY_LIMIT } from "./limits";

export const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The instant the current Eastern calendar month began, and the instant the
 * next one does — as absolute timestamps.
 *
 * Computed by Postgres rather than in JavaScript so the month boundary is one
 * expression that already understands daylight saving, and so it matches the
 * timezone every date in the UI is printed in.
 */
const MONTH_START = raw`date_trunc('month', now() AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York'`;
const NEXT_MONTH_START = raw`(date_trunc('month', now() AT TIME ZONE 'America/New_York') + interval '1 month') AT TIME ZONE 'America/New_York'`;

/**
 * Extract the client IP.
 *
 * Apache's mod_proxy APPENDS the real peer address to X-Forwarded-For, so the
 * LAST entry is the one Apache observed and the only one a client cannot spoof.
 * A client sending "X-Forwarded-For: 1.2.3.4" gets "1.2.3.4, <their real ip>".
 * Taking the first entry here would let anyone forge an identity and bypass
 * the limit entirely.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * The video id of this IP's most recent lookup.
 *
 * Used to make an immediate repeat free: searching the same URL twice in a row
 * (or refreshing the page) should not cost a second lookup. Only the LAST one
 * counts — URL1, URL2, URL1 is three lookups, because the second URL1 is not a
 * repeat of what came directly before it.
 *
 * Ordered by id, not requestedAt: two rows can share a timestamp, and the
 * serial id is the only strict tiebreaker for "most recent".
 */
export async function getLastLookupVideoId(ip: string): Promise<string | null> {
  const [row] = await db
    .select({ videoId: lookups.videoId })
    .from(lookups)
    .where(eq(lookups.ipAddress, ip))
    .orderBy(desc(lookups.id))
    .limit(1);

  return row?.videoId ?? null;
}

export type RateLimitVerdict = {
  allowed: boolean;
  /** Lookups spent in the current window. Always 0 for the uncapped. */
  used: number;
  /** Remaining allowance, or null when the caller is uncapped. */
  remaining: number | null;
  /** The ceiling in force, or null when there is none. */
  limit: number | null;
  /** Which window `limit` is measured over, or null when uncapped. */
  period: LimitPeriod | null;
  /** True only for admins now — Pro is capped like everyone else. */
  unlimited: boolean;
  retryAfterSeconds: number;
};

/**
 * @param ip      client IP, from getClientIp
 * @param plan    the plan on the signed-in user's row, or undefined
 * @param role    that user's role. Admins are uncapped.
 * @param userId  the signed-in user's id. REQUIRED for a Pro allowance to be
 *                counted per account; without it a Pro caller falls back to
 *                the free IP limit, which fails closed rather than open.
 *
 *   Pass the REAL account plan and role, never resolvePlan()'s output — that
 *   honours ?plan=pro in development, which would turn the dev preview into a
 *   rate-limit bypass. The role is a real entitlement, so it belongs here.
 */
export async function checkRateLimit({
  ip,
  plan,
  role,
  userId,
}: {
  ip: string;
  plan?: string;
  role?: string;
  userId?: string;
}): Promise<RateLimitVerdict> {
  if (isAdmin(role)) {
    return {
      allowed: true,
      used: 0,
      remaining: null,
      limit: null,
      period: null,
      unlimited: true,
      retryAfterSeconds: 0,
    };
  }

  if (plan === "pro" && userId) {
    const [row] = await db
      .select({
        used: raw<number>`COUNT(*)::int`,
        resetsAt: raw<string>`${NEXT_MONTH_START}`,
      })
      .from(lookups)
      .where(and(eq(lookups.userId, userId), gte(lookups.requestedAt, MONTH_START)));

    const used = row?.used ?? 0;
    // The whole allowance returns at once on the 1st, unlike the free tier
    // where slots trickle back individually.
    const resetsAt = row?.resetsAt ? new Date(row.resetsAt).getTime() : Date.now();

    return {
      allowed: used < PRO_MONTHLY_LOOKUPS,
      used,
      remaining: Math.max(0, PRO_MONTHLY_LOOKUPS - used),
      limit: PRO_MONTHLY_LOOKUPS,
      period: "month",
      unlimited: false,
      retryAfterSeconds: Math.max(1, Math.ceil((resetsAt - Date.now()) / 1000)),
    };
  }

  const since = new Date(Date.now() - WINDOW_MS);

  const [row] = await db
    .select({
      used: raw<number>`COUNT(*)::int`,
      oldest: raw<Date | null>`MIN(${lookups.requestedAt})`,
    })
    .from(lookups)
    .where(and(eq(lookups.ipAddress, ip), gt(lookups.requestedAt, since)));

  const used = row?.used ?? 0;

  // A slot frees when the oldest lookup still inside the window ages out of it.
  const oldest = row?.oldest ? new Date(row.oldest).getTime() : Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000));

  return {
    allowed: used < FREE_DAILY_LOOKUPS,
    used,
    remaining: Math.max(0, FREE_DAILY_LOOKUPS - used),
    limit: FREE_DAILY_LOOKUPS,
    period: "day",
    unlimited: false,
    retryAfterSeconds,
  };
}

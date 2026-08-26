import { and, desc, eq, gt, sql as raw } from "drizzle-orm";
import { db, lookups } from "@/db";
import { isPro, type Plan } from "./plans";

/**
 * Volume limiting, backed by the `lookups` table we already write to.
 *
 * ONE ceiling: DAILY_LIMIT lookups per IP per rolling 24 hours.
 *
 * Every lookup counts, cache hits included. That is deliberate even though a
 * cache hit costs no YouTube quota: "10 free lookups a day" is something a
 * visitor can understand and predict, whereas a limit that only counts cache
 * misses would make popular videos free and obscure ones not, with no visible
 * reason why. The database cost of a cached lookup is not zero either.
 *
 * Paying subscribers are exempt entirely — see checkRateLimit.
 */
export const DAILY_LIMIT = 10;
export const WINDOW_MS = 24 * 60 * 60 * 1000;

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
  /** Lookups used in the current window. Always 0 for exempt subscribers. */
  used: number;
  /** Remaining allowance, or null when the caller is unlimited. */
  remaining: number | null;
  /** True when the caller is a paying subscriber and no limit applies. */
  unlimited: boolean;
  retryAfterSeconds: number;
};

/**
 * @param ip          client IP, from getClientIp
 * @param sessionPlan the plan on the signed-in user's row, or undefined.
 *
 *   Pass the REAL account plan here, never resolvePlan()'s output — that
 *   honours ?plan=pro in development, which would turn the dev preview into a
 *   rate-limit bypass.
 */
export async function checkRateLimit(
  ip: string,
  sessionPlan?: string
): Promise<RateLimitVerdict> {
  if (sessionPlan && isPro(sessionPlan as Plan)) {
    return { allowed: true, used: 0, remaining: null, unlimited: true, retryAfterSeconds: 0 };
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
    allowed: used < DAILY_LIMIT,
    used,
    remaining: Math.max(0, DAILY_LIMIT - used),
    unlimited: false,
    retryAfterSeconds,
  };
}

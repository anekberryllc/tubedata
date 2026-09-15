import "server-only";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db, apiKeys } from "@/db";

/**
 * The YouTube API key pool.
 *
 * SERVER ONLY, and the `server-only` import at the top is the enforcement, not
 * a comment: this module selects plaintext API keys out of the database, and a
 * client component that imported it by accident would both break the build the
 * way the DATABASE_URL incident did AND ship a credential to the browser. The
 * import makes that a build error instead of an incident.
 *
 * WHAT GOOGLE DOES NOT GIVE US: any way to ask how much quota a key has left.
 * There is no endpoint, and the Cloud Console figure is not exposed. So "use
 * the key that has quota" cannot be answered in advance — it is discovered by
 * spending one and being told no. Everything here follows from that:
 *
 *   - keys are tried IN ORDER (sortOrder, then id), so the pool is predictable
 *     and an admin can decide which key burns first;
 *   - a quotaExceeded answer sets `exhaustedAt` and the caller moves to the
 *     next key, so one visitor eats the discovery and nobody after them does;
 *   - exhaustion EXPIRES BY ITSELF at the next Pacific midnight, because that
 *     is when Google resets. No cron, no cleanup job, nothing to forget.
 *
 * `unitsToday` is our own tally of calls we made with a key. It is an estimate
 * and is labelled as one in the UI: anything else using the same key — another
 * app, a script, a colleague — spends quota we never see.
 */

/**
 * YouTube quota resets at midnight PACIFIC, not UTC and not our local zone.
 *
 * Intl rather than the Postgres date_trunc used in rate-limit.ts, because all
 * that is needed here is a day LABEL to compare two timestamps against, not an
 * absolute boundary to filter rows by. `en-CA` because it formats as
 * YYYY-MM-DD, which sorts and compares as a string.
 */
const PACIFIC = "America/Los_Angeles";

export function pacificDay(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Daily units Google grants a project by default. Display only — see above. */
export const DEFAULT_DAILY_QUOTA = 10_000;

export type PoolKey = { id: number; key: string; label: string };

/**
 * Keys worth trying, best first.
 *
 * "Exhausted" is filtered in SQL against today's Pacific day rather than by
 * reading rows and deciding in JavaScript, so a key that expired at Google's
 * reset becomes usable again on the very next query with nothing having run.
 */
export async function getUsableKeys(): Promise<PoolKey[]> {
  const today = pacificDay();

  return db
    .select({ id: apiKeys.id, key: apiKeys.key, label: apiKeys.label })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.active, true),
        // A key refused as invalid stays out until a person clears the flag.
        // Unlike quota, nothing about tomorrow makes a revoked key work.
        isNull(apiKeys.invalidAt),
        or(
          isNull(apiKeys.exhaustedAt),
          sql`to_char(${apiKeys.exhaustedAt} AT TIME ZONE ${PACIFIC}, 'YYYY-MM-DD') < ${today}`
        )
      )
    )
    .orderBy(asc(apiKeys.sortOrder), asc(apiKeys.id));
}

/** Is the pool set up at all? Decides whether the env fallback is used. */
export async function hasAnyKeys(): Promise<boolean> {
  const [row] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(apiKeys);
  return (row?.n ?? 0) > 0;
}

/**
 * Record that a key was spent.
 *
 * The daily tally resets by comparing the stored day to today rather than by
 * zeroing rows at midnight — same reasoning as exhaustion, one less moving
 * part. Done in SQL so the read and the write cannot interleave with another
 * request and lose a count.
 */
export async function noteKeyUsed(id: number, units = 1): Promise<void> {
  const today = pacificDay();

  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
      unitsDate: today,
      unitsToday: sql`CASE WHEN ${apiKeys.unitsDate} = ${today}
                          THEN ${apiKeys.unitsToday} + ${units}
                          ELSE ${units} END`,
    })
    .where(eq(apiKeys.id, id));
}

/** Google said the daily quota is gone. Out of rotation until its reset. */
export async function markKeyExhausted(id: number, message: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ exhaustedAt: new Date(), lastError: message.slice(0, 500) })
    .where(eq(apiKeys.id, id));
}

/**
 * Google refused the key itself. Out of rotation until a person looks at it.
 *
 * Deliberately does NOT set `active = false`: that flag is the admin's switch,
 * and overwriting it would mean an admin who re-enables a fixed key finds it
 * mysteriously off again, or cannot tell whether they or the system turned it
 * off. Two flags, two owners.
 */
export async function markKeyInvalid(id: number, message: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ invalidAt: new Date(), lastError: message.slice(0, 500) })
    .where(eq(apiKeys.id, id));
}

/* ------------------------------------------------------------------ *
 * Admin-facing reads and writes
 * ------------------------------------------------------------------ */

export type AdminApiKey = {
  id: number;
  label: string;
  /** MASKED. The full key is never sent to a browser. */
  masked: string;
  active: boolean;
  sortOrder: number;
  exhausted: boolean;
  exhaustedAt: Date | null;
  invalidAt: Date | null;
  lastError: string | null;
  lastUsedAt: Date | null;
  unitsToday: number;
  createdAt: Date;
};

/**
 * Show enough of a key to recognise it and not enough to use it.
 *
 * Google's keys start "AIza" and run 39 characters. Keeping the first four is
 * useless for an attacker (every key has them) and keeping the last four is
 * how the admin tells two keys apart, which is the entire job here.
 */
export function maskKey(key: string): string {
  if (key.length <= 12) return "•".repeat(Math.max(key.length, 4));
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export async function listApiKeys(): Promise<AdminApiKey[]> {
  const today = pacificDay();

  const rows = await db
    .select()
    .from(apiKeys)
    .orderBy(asc(apiKeys.sortOrder), asc(apiKeys.id));

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    masked: maskKey(r.key),
    active: r.active,
    sortOrder: r.sortOrder,
    // Computed the same way getUsableKeys filters, so the panel cannot claim a
    // key is out of rotation while the pool is happily using it.
    exhausted: !!r.exhaustedAt && pacificDay(r.exhaustedAt) >= today,
    exhaustedAt: r.exhaustedAt ?? null,
    invalidAt: r.invalidAt ?? null,
    lastError: r.lastError ?? null,
    lastUsedAt: r.lastUsedAt ?? null,
    // Stale tally from a previous day reads as zero rather than as today's use.
    unitsToday: r.unitsDate === today ? r.unitsToday : 0,
    createdAt: r.createdAt,
  }));
}

/** Shape check before spending a request on a key we can already tell is wrong. */
export function looksLikeApiKey(key: string): boolean {
  return /^AIza[A-Za-z0-9_-]{30,40}$/.test(key.trim());
}

/**
 * Ask Google whether a key works, before it is trusted with real traffic.
 *
 * Costs one quota unit against the key being tested, which is the right price
 * for finding out now instead of during someone's lookup. Uses a video ID that
 * is certain to exist rather than a made-up one, so "not found" cannot be
 * confused with "key rejected".
 */
export async function verifyKey(
  key: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${encodeURIComponent(key)}`,
    { cache: "no-store" }
  );

  if (res.ok) return { ok: true };

  const body = await res.json().catch(() => null);
  const message =
    (body as { error?: { message?: string } })?.error?.message ??
    `Google returned ${res.status}.`;
  return { ok: false, message };
}

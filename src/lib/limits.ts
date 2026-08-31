/**
 * How many lookups each tier gets, and the words used to describe them.
 *
 * Deliberately free of any database or server import: these numbers appear in
 * client components — the counter under the search box, the user menu, the
 * upgrade dialog — and rate-limit.ts, which enforces them, must not be pulled
 * into the browser bundle just to read a constant.
 *
 * THREE CEILINGS, as of 2026-08-31:
 *   free   — FREE_DAILY_LOOKUPS per IP, rolling 24 hours (rate-limit.ts)
 *   Pro    — PRO_MONTHLY_LOOKUPS per ACCOUNT, per calendar month
 *   admin  — none; staff are operating the site, not buying it
 *
 * Pro was unlimited until 2026-08-31. It is capped now, which means a
 * subscriber can run out — so the prepaid packs are no longer pointless for
 * them, and the copy must never promise "unlimited" again. Anything quoting a
 * number to a user should read it from here rather than writing it down.
 */

/** Free tier, per IP, per rolling 24 hours. */
export const FREE_DAILY_LOOKUPS = 10;

/** Pro, per account, per calendar month (Eastern). */
export const PRO_MONTHLY_LOOKUPS = 1000;

export const formatLookups = (n: number) => n.toLocaleString("en-US");

/** "1,000 lookups a month" — the phrase used wherever Pro is described. */
export const PRO_ALLOWANCE_LABEL = `${formatLookups(PRO_MONTHLY_LOOKUPS)} lookups a month`;

/** Which window a caller's allowance is measured over. */
export type LimitPeriod = "day" | "month";

/** "today" / "this month", for sentences about what is left. */
export const PERIOD_LABEL: Record<LimitPeriod, string> = {
  day: "today",
  month: "this month",
};

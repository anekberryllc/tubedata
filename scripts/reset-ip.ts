/**
 * Reset the daily lookup allowance for the loopback IPs the local browser uses.
 *
 * Anonymous rows are test traffic and are deleted outright. Rows belonging to a
 * signed-in user are that user's lookup HISTORY, so they are backdated out of
 * the rolling 24h window instead of destroyed — the counter resets, the history
 * page still has its rows.
 */
import { and, gt, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { db, lookups } from "@/db";
import { checkRateLimit, DAILY_LIMIT, WINDOW_MS } from "@/lib/rate-limit";

const LOOPBACK = ["127.0.0.1", "::1", "unknown"];

async function main() {
  const since = new Date(Date.now() - WINDOW_MS);
  const inWindow = and(inArray(lookups.ipAddress, LOOPBACK), gt(lookups.requestedAt, since));

  const deleted = await db
    .delete(lookups)
    .where(and(inWindow, isNull(lookups.userId)))
    .returning({ id: lookups.id });
  console.log(`deleted ${deleted.length} anonymous test rows`);

  // 25 hours back: comfortably outside the window, no clock-skew edge case.
  const backdated = await db
    .update(lookups)
    .set({ requestedAt: sql`NOW() - INTERVAL '25 hours'` })
    .where(and(inWindow, isNotNull(lookups.userId)))
    .returning({ id: lookups.id });
  console.log(`backdated ${backdated.length} signed-in history rows (kept, moved out of the window)`);

  const [total] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(lookups)
    .where(isNotNull(lookups.userId));
  console.log(`signed-in history rows still present: ${total?.n ?? 0}`);

  console.log("\nallowance now:");
  for (const ip of ["127.0.0.1", "::1"]) {
    const v = await checkRateLimit(ip);
    console.log(`  ${ip.padEnd(12)} used=${v.used} remaining=${v.remaining}/${DAILY_LIMIT}`);
  }
}

main();

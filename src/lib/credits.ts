import { and, eq, gt, sql } from "drizzle-orm";
import { db, users } from "@/db";

/**
 * Spend one prepaid lookup.
 *
 * Written as a single conditional UPDATE rather than read-then-write: two
 * concurrent lookups on the same account would otherwise both read a balance
 * of 1 and both proceed, handing out a free lookup. The `> 0` guard lives in
 * the WHERE clause so the database decides, and the row lock serialises it.
 *
 * @returns the remaining balance, or null if there was nothing to spend.
 */
export async function spendCredit(userId: string): Promise<number | null> {
  const [row] = await db
    .update(users)
    .set({ lookupCredits: sql`${users.lookupCredits} - 1` })
    .where(and(eq(users.id, userId), gt(users.lookupCredits, 0)))
    .returning({ remaining: users.lookupCredits });

  return row?.remaining ?? null;
}

/**
 * Hand a credit back when the lookup it paid for produced nothing usable
 * (bad URL, deleted video, upstream API failure).
 */
export async function refundCredit(userId: string): Promise<number> {
  const [row] = await db
    .update(users)
    .set({ lookupCredits: sql`${users.lookupCredits} + 1` })
    .where(eq(users.id, userId))
    .returning({ remaining: users.lookupCredits });

  return row?.remaining ?? 0;
}

export async function getCredits(userId: string): Promise<number> {
  const [row] = await db
    .select({ credits: users.lookupCredits })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row?.credits ?? 0;
}

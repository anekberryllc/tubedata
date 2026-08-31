import { desc, eq, sql } from "drizzle-orm";
import { db, users, refundRequests } from "@/db";
import { isRefundStatus } from "./refund-status";

/**
 * The refund queue, for the admin panel.
 *
 * The table is deliberately a QUEUE rather than an automatic Stripe refund —
 * moving money back is irreversible and wants a person to look at it. That
 * design only works if the queue is actually visible somewhere, which until
 * now it was not: the overview counted open requests and told you to go read
 * the database.
 *
 * Statuses match the ones the user sees on their account page exactly
 * (components/RefundRequestForm.tsx). Anything set here is shown to them, so
 * "declined" is not an internal note — it is a message.
 */

// Defined in refund-status.ts, which has no server imports — the decision
// buttons are a client component and cannot reach this file. Re-exported so
// server callers still get everything from one place.
export { REFUND_STATUSES, isRefundStatus, type RefundStatus } from "./refund-status";

export type AdminRefund = {
  id: number;
  userId: string;
  status: string;
  reason: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  /** Snapshotted when the request was made — what they were on at the time. */
  snapshotEmail: string | null;
  snapshotPlan: string | null;
  stripeCustomerId: string | null;
  /** The account as it is NOW. Null if it has since been deleted. */
  currentEmail: string | null;
  currentName: string | null;
  currentPlan: string | null;
  /** Set once money has actually gone back. Its presence blocks a second one. */
  stripeRefundId: string | null;
  stripeChargeId: string | null;
  refundedAmountCents: number | null;
  refundedBy: string | null;
};

/**
 * @param status omit for every request; pass one to filter.
 *
 * Newest first, which is wrong for a work queue in general — but a refund
 * request that has just landed is the one someone is waiting on, and the open
 * ones are few enough to read at a glance.
 */
export async function listRefunds(status?: string): Promise<AdminRefund[]> {
  const rows = await db
    .select({
      id: refundRequests.id,
      userId: refundRequests.userId,
      status: refundRequests.status,
      reason: refundRequests.reason,
      createdAt: refundRequests.createdAt,
      resolvedAt: refundRequests.resolvedAt,
      snapshotEmail: refundRequests.email,
      snapshotPlan: refundRequests.plan,
      stripeCustomerId: refundRequests.stripeCustomerId,
      stripeRefundId: refundRequests.stripeRefundId,
      stripeChargeId: refundRequests.stripeChargeId,
      refundedAmountCents: refundRequests.refundedAmountCents,
      refundedBy: refundRequests.refundedBy,
      currentEmail: users.email,
      currentName: users.name,
      currentPlan: users.plan,
    })
    .from(refundRequests)
    // LEFT so a request survives the account being deleted — the snapshot
    // columns are there precisely so it still says who asked and what for.
    .leftJoin(users, eq(users.id, refundRequests.userId))
    .where(status && isRefundStatus(status) ? eq(refundRequests.status, status) : undefined)
    .orderBy(desc(refundRequests.createdAt));

  return rows;
}

/** Drives the badge on the admin nav, so a new request is impossible to miss. */
export async function countOpenRefunds(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(refundRequests)
    .where(eq(refundRequests.status, "open"));
  return row?.n ?? 0;
}

/** How many sit in each status, for the filter tabs. */
export async function countRefundsByStatus(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: refundRequests.status, n: sql<number>`COUNT(*)::int` })
    .from(refundRequests)
    .groupBy(refundRequests.status);

  return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

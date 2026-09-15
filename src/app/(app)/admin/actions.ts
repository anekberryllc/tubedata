"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, users, refundRequests } from "@/db";
import { currentAdmin, countAdmins } from "@/lib/admin";
import {
  listRefundableCharges,
  type RefundableCharge,
} from "@/lib/stripe-refunds";
import type { Role } from "@/lib/roles";
import { isRefundStatus, type RefundStatus } from "@/lib/refund-status";
import { refundCharge } from "@/lib/stripe-refunds";
import { notifySupport } from "@/lib/email";

/**
 * Moderation actions.
 *
 * Every one of these re-checks that the caller is an admin. Server actions are
 * ordinary HTTP endpoints with a generated id — rendering the panel only for
 * admins hides the buttons, it does not protect the action behind them.
 *
 * The invariants below exist to make it impossible to lock every admin out of
 * the site with one click:
 *   - you cannot change your own role, and cannot block yourself;
 *   - an admin cannot be blocked at all — demote them to member first, which
 *     is a second, deliberate step by a second person;
 *   - the last remaining admin cannot be demoted.
 */

/**
 * Refresh every admin screen after a change.
 *
 * "layout" scope rather than the default "page": these actions are invoked
 * from BOTH the user list and a user's profile, and the change is visible on
 * both plus the lookups view. Revalidating only /admin would leave whichever
 * profile page you acted from showing the state you just changed.
 */
function refreshAdmin() {
  revalidatePath("/admin", "layout");
}

export type ActionResult = { ok: true } | { ok: false; message: string };

const MAX_REASON = 500;

export async function setUserRole(userId: string, role: Role): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorized." };

  if (role !== "admin" && role !== "member") {
    return { ok: false, message: "Unknown role." };
  }
  if (userId === admin.id) {
    return {
      ok: false,
      message: "You can't change your own role. Ask another admin to do it.",
    };
  }

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { ok: false, message: "User not found." };
  if (target.role === role) return { ok: true };

  if (role === "member" && target.role === "admin" && (await countAdmins()) <= 1) {
    return { ok: false, message: "That's the last admin — promote someone else first." };
  }
  // Keeps "an admin is never blocked" true, which is what lets the block rules
  // stay this simple everywhere else.
  if (role === "admin" && target.blockedAt) {
    return { ok: false, message: "Unblock this account before making it an admin." };
  }

  await db.update(users).set({ role }).where(eq(users.id, userId));
  refreshAdmin();
  return { ok: true };
}

export async function blockUser(userId: string, reason: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorized." };

  if (userId === admin.id) {
    return { ok: false, message: "You can't block yourself." };
  }

  const trimmed = (reason ?? "").trim();
  if (trimmed.length > MAX_REASON) {
    return { ok: false, message: `Keep the reason under ${MAX_REASON} characters.` };
  }

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { ok: false, message: "User not found." };
  if (target.role === "admin") {
    return { ok: false, message: "Admins can't be blocked. Demote to member first." };
  }

  // The session rows are deliberately left alone. Deleting them would sign the
  // user out, and a signed-out visitor is just an anonymous one who still gets
  // the free daily allowance — the block would achieve nothing. Kept signed in,
  // they are identified on every request and see why they were suspended.
  await db
    .update(users)
    .set({
      blockedAt: new Date(),
      blockedReason: trimmed || null,
      blockedBy: admin.id,
    })
    .where(eq(users.id, userId));

  refreshAdmin();
  return { ok: true };
}

export async function unblockUser(userId: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorized." };

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { ok: false, message: "User not found." };

  // Clearing all three together: a stale reason on an active account would be
  // read as a current one the next time someone looks.
  await db
    .update(users)
    .set({ blockedAt: null, blockedReason: null, blockedBy: null })
    .where(eq(users.id, userId));

  refreshAdmin();
  return { ok: true };
}

/**
 * Record a decision on a refund request.
 *
 * This does NOT move money. Issuing the refund itself stays in Stripe, on
 * purpose — a refund button of our own would be a second, irreversible path to
 * the same action with none of Stripe's protections. What this records is the
 * decision, which is also what the requester is shown on their account page:
 * "declined" here is a message to a person, not an internal note.
 *
 * Every status is reachable from every other, including back to "open". A
 * misclick on someone's refund should be correctable in one click.
 */
export async function setRefundStatus(
  id: number,
  status: RefundStatus
): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorized." };

  if (!isRefundStatus(status)) return { ok: false, message: "Unknown status." };

  const [updated] = await db
    .update(refundRequests)
    .set({
      status,
      // Reopening clears the resolution time rather than leaving a date that
      // claims the request was settled while it is back in the queue.
      resolvedAt: status === "open" ? null : new Date(),
    })
    .where(eq(refundRequests.id, id))
    .returning({ id: refundRequests.id });

  if (!updated) return { ok: false, message: "Refund request not found." };

  refreshAdmin();
  return { ok: true };
}

/**
 * ISSUE A REAL REFUND. This is the only place in the application where money
 * moves back to a customer, and it cannot be undone from here or anywhere
 * else — Stripe has no un-refund.
 *
 * Four independent guards, because one is not enough for an irreversible
 * transfer:
 *
 *   1. The caller must still be an admin, re-checked here.
 *   2. The request must not already carry a stripeRefundId. That column is
 *      the record that money has gone, so a second attempt is refused
 *      outright rather than issuing a second refund.
 *   3. Stripe is called with an idempotency key derived from the request id,
 *      so a double-clicked button or a replayed POST returns the ORIGINAL
 *      refund instead of creating another.
 *   4. The charge must belong to the customer named on the request, so a
 *      tampered form cannot refund a charge belonging to somebody else.
 *
 * The database is written only AFTER Stripe confirms. If that write fails,
 * the money is gone and we have not recorded it — so the failure is reported
 * loudly, with the refund id, rather than swallowed.
 */
export async function issueRefund(
  requestId: number,
  chargeId: string,
  amountCents: number
): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorized." };

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }

  const [request] = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.id, requestId))
    .limit(1);

  if (!request) return { ok: false, message: "Refund request not found." };

  if (request.stripeRefundId) {
    return {
      ok: false,
      message: `Already refunded (${request.stripeRefundId}). Issue anything further in Stripe.`,
    };
  }

  // The charge has to belong to the person who asked. Verified against
  // Stripe rather than trusting the id the browser sent back.
  if (!request.stripeCustomerId) {
    return { ok: false, message: "This account has no Stripe customer to refund." };
  }

  const owned = await listRefundableCharges(request.stripeCustomerId);
  if (!owned.ok) return { ok: false, message: owned.message };

  const charge = owned.charges.find((c) => c.id === chargeId);
  if (!charge) {
    return { ok: false, message: "That charge does not belong to this customer." };
  }
  if (amountCents > charge.refundableCents) {
    return {
      ok: false,
      message: `Only ${(charge.refundableCents / 100).toFixed(2)} is still refundable on that charge.`,
    };
  }

  const result = await refundCharge({ requestId, chargeId, amountCents });
  if (!result.ok) return { ok: false, message: result.message };

  try {
    await db
      .update(refundRequests)
      .set({
        status: "refunded",
        resolvedAt: new Date(),
        stripeRefundId: result.refundId,
        stripeChargeId: chargeId,
        refundedAmountCents: result.amountCents,
        refundedBy: admin.id,
      })
      .where(eq(refundRequests.id, requestId));
  } catch {
    // Money HAS left. Losing the record of it is the worst outcome here, so
    // say so plainly and hand back the id needed to reconcile by hand.
    return {
      ok: false,
      message: `Refund ${result.refundId} SUCCEEDED in Stripe but could not be recorded here. Do not retry — record it manually.`,
    };
  }

  await notifySupport(
    `Refund issued: ${(result.amountCents / 100).toFixed(2)} to ${request.email ?? request.userId}`,
    `${admin.email ?? admin.id} refunded ${(result.amountCents / 100).toFixed(2)} against charge ${chargeId}.

Stripe refund: ${result.refundId}
Request: #${requestId}`
  );

  refreshAdmin();
  return { ok: true };
}

/**
 * The customer's charges, for choosing what to refund against.
 *
 * Loaded on demand rather than with the page: it is a network round trip to
 * Stripe per request, and most visits to the queue are to read it, not to
 * refund. Opening the panel is the moment the admin has decided to look.
 */
export async function listChargesForRequest(requestId: number): Promise<
  | { ok: true; charges: RefundableCharge[] }
  | { ok: false; message: string }
> {
  const admin = await currentAdmin();
  if (!admin) return { ok: false, message: "Not authorized." };

  const [request] = await db
    .select({ customerId: refundRequests.stripeCustomerId })
    .from(refundRequests)
    .where(eq(refundRequests.id, requestId))
    .limit(1);

  if (!request) return { ok: false, message: "Refund request not found." };
  if (!request.customerId) {
    return { ok: false, message: "This account has never been billed through Stripe." };
  }

  return listRefundableCharges(request.customerId);
}

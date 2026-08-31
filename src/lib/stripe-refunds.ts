import { stripe } from "./stripe";

/**
 * The Stripe side of refunding: what a customer has paid, and what is still
 * refundable.
 *
 * Kept out of admin-refunds.ts so the refund queue itself stays a database
 * concern and this file is the only place that reaches out to Stripe over the
 * network. Issuing the refund lives in the server action, not here, because it
 * has to write to our database in the same breath.
 */

export type RefundableCharge = {
  id: string;
  /** What was originally charged. */
  amountCents: number;
  /** Already given back, from earlier refunds. */
  refundedCents: number;
  /** What can still be refunded — the ceiling on any new refund. */
  refundableCents: number;
  currency: string;
  description: string | null;
  created: Date;
};

export type ChargeList =
  | { ok: true; charges: RefundableCharge[] }
  | { ok: false; message: string };

/**
 * Successful charges for a customer, newest first.
 *
 * Read live rather than from our own tables on purpose: `credit_purchases` and
 * `donations` only record what our webhook saw, and subscription invoices are
 * not in our database at all. Refunding has to work from what Stripe actually
 * holds — including payments we never recorded, which is precisely the case
 * when a webhook was missed.
 *
 * Failures are returned, not thrown: Stripe being unreachable should grey out
 * the refund controls, not break the whole queue.
 */
export async function listRefundableCharges(
  customerId: string,
  limit = 10
): Promise<ChargeList> {
  try {
    const list = await stripe.charges.list({ customer: customerId, limit });

    const charges = list.data
      // Failed and uncaptured charges took no money, so there is nothing to
      // give back and offering them would only invite an error from Stripe.
      .filter((c) => c.status === "succeeded" && (c.amount_captured ?? c.amount) > 0)
      .map((c) => {
        const captured = c.amount_captured || c.amount;
        return {
          id: c.id,
          amountCents: captured,
          refundedCents: c.amount_refunded,
          refundableCents: Math.max(0, captured - c.amount_refunded),
          currency: c.currency,
          description: c.description,
          created: new Date(c.created * 1000),
        };
      });

    return { ok: true, charges };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not reach Stripe.",
    };
  }
}

export type RefundResult =
  | { ok: true; refundId: string; amountCents: number }
  | { ok: false; message: string };

/**
 * Send money back for one charge.
 *
 * THE IDEMPOTENCY KEY IS THE WHOLE SAFETY STORY. It is derived from the refund
 * REQUEST id, so every retry of the same request — a double-clicked button, a
 * resubmitted server action, a browser that repeated the POST — reaches Stripe
 * as the same operation and returns the original refund instead of issuing a
 * second one. Without it, two clicks is twice the money, and money that has
 * left cannot be pulled back.
 *
 * Deliberately does NOT touch our database; the caller records the result, so
 * that "money moved" and "we wrote it down" stay in one place and one order.
 */
export async function refundCharge({
  requestId,
  chargeId,
  amountCents,
}: {
  requestId: number;
  chargeId: string;
  /** Omit to refund the full remaining amount. */
  amountCents?: number;
}): Promise<RefundResult> {
  try {
    const refund = await stripe.refunds.create(
      {
        charge: chargeId,
        ...(amountCents ? { amount: amountCents } : {}),
        // Surfaces in the Stripe dashboard, so a refund found there can be
        // traced back to the request that caused it.
        metadata: { tubedataRefundRequestId: String(requestId) },
      },
      { idempotencyKey: `refund-request-${requestId}` }
    );

    return { ok: true, refundId: refund.id, amountCents: refund.amount };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Stripe refused the refund.",
    };
  }
}

import type Stripe from "stripe";
import { db, donations } from "@/db";

/**
 * Write a completed tip to the donations table.
 *
 * SERVER ONLY — it imports the database. Never import this from a client
 * component. It is deliberately a separate file from lib/donations.ts, which
 * holds the tier list and IS imported by the BuyMeACoffee client component;
 * putting this function there would drag the database into the browser bundle.
 *
 * GRANTS NOTHING. This function touches one table and never `users`. Keep it
 * that way — the whole reason the webhook's donation branch is separate from
 * the subscription branch is that a $3 tip must not be able to confer a plan.
 *
 * Idempotent: Stripe retries webhook deliveries, and `stripe_session_id` is
 * UNIQUE, so a redelivery lands on the conflict and counts nothing twice.
 *
 * @returns true when this call actually inserted the row.
 */
export async function recordDonation(s: Stripe.Checkout.Session): Promise<boolean> {
  // A session can complete before the money arrives when the customer picks a
  // delayed payment method. Those settle later via
  // checkout.session.async_payment_succeeded, which lands here too — recording
  // on "unpaid" would book a tip that may never be paid.
  if (s.payment_status !== "paid") {
    console.warn("donation session not paid, skipping", s.id, s.payment_status);
    return false;
  }

  const amountCents = s.amount_total;
  if (amountCents === null || amountCents <= 0) {
    console.warn("donation session has no amount", s.id);
    return false;
  }

  const paymentIntentId =
    typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;

  const inserted = await db
    .insert(donations)
    .values({
      // Null for an anonymous tip, which is a supported case, not a failure.
      userId: s.metadata?.userId ?? null,
      stripeSessionId: s.id,
      stripePaymentIntentId: paymentIntentId,
      tierId: s.metadata?.tier ?? null,
      amountCents,
      currency: s.currency ?? "usd",
      email: s.customer_details?.email ?? null,
    })
    .onConflictDoNothing({ target: donations.stripeSessionId })
    .returning({ id: donations.id });

  return inserted.length > 0;
}

import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db, users, creditPurchases } from "@/db";
import { stripe, planForPrice, ACTIVE_STATUSES } from "@/lib/stripe";
import { recordDonation } from "@/lib/record-donation";
import { notifySupport } from "@/lib/email";

/**
 * Add prepaid lookups to a user's balance, exactly once.
 *
 * Stripe redelivers webhooks on any non-2xx and occasionally on success, so
 * this MUST be idempotent. The unique constraint on stripe_session_id is what
 * enforces that: the balance is only topped up when the insert actually
 * created a row, which can happen at most once per Checkout session.
 */
async function grantLookupCredits(s: Stripe.Checkout.Session) {
  const userId = s.client_reference_id ?? s.metadata?.userId;
  const credits = Number(s.metadata?.credits ?? 0);

  if (!userId || !Number.isFinite(credits) || credits <= 0) {
    console.warn("lookup_pack session missing userId or credits", s.id);
    return;
  }

  const inserted = await db
    .insert(creditPurchases)
    .values({
      userId,
      stripeSessionId: s.id,
      packId: s.metadata?.packId ?? null,
      credits,
      amountCents: s.amount_total ?? null,
    })
    .onConflictDoNothing({ target: creditPurchases.stripeSessionId })
    .returning({ id: creditPurchases.id });

  if (inserted.length === 0) return; // already granted on an earlier delivery

  await db
    .update(users)
    .set({ lookupCredits: sql`${users.lookupCredits} + ${credits}` })
    .where(eq(users.id, userId));
}

/**
 * Stripe webhook. This is the entire point of the billing integration: it
 * writes the `plan` column on the user row, which the paywall already reads.
 *
 * Deliberately NOT behind auth — Stripe is the caller, not a signed-in user.
 * Authenticity comes from the signature check below, which is why the raw
 * request body is required (JSON.parse would change the bytes and break it).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, message: "Webhook secret not configured." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, message: "Missing signature." }, { status: 400 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    // A bad signature means the request did not come from Stripe. Reject it.
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  async function setPlanByCustomer(customerId: string, plan: string) {
    const updated = await db
      .update(users)
      .set({ plan })
      .where(eq(users.stripeCustomerId, customerId))
      .returning({ id: users.id });

    // No row matched: Stripe knows about a customer we cannot map to an
    // account, so somebody's payment is not granting them anything. This used
    // to pass silently — the update simply affected zero rows — and the only
    // way to notice was to compare Stripe against the database by hand.
    if (updated.length === 0) {
      await notifySupport(
        `Stripe event for an unknown customer (${customerId})`,
        `A ${event.type} event arrived for Stripe customer ${customerId}, but no
user row has that stripeCustomerId, so plan="${plan}" was not applied.

Someone may have paid and received nothing. Check that customer in Stripe
against the accounts in /admin.`
      );
    }
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;

      // Three kinds of session arrive here and they must not be confused.
      // Both non-subscription kinds break out BEFORE the plan-granting code
      // below: its `?? "pro"` default would otherwise hand a $3 tipper a free
      // Pro plan. Recording a donation is bookkeeping only — recordDonation
      // never touches `users`.
      if (s.mode !== "subscription") {
        if (s.metadata?.kind === "lookup_pack") await grantLookupCredits(s);
        else if (s.metadata?.kind === "donation") await recordDonation(s);
        break;
      }

      const userId = s.client_reference_id ?? s.metadata?.userId;
      const plan = s.metadata?.plan ?? "pro";
      const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;

      if (userId) {
        await db
          .update(users)
          .set({ plan, ...(customerId ? { stripeCustomerId: customerId } : {}) })
          .where(eq(users.id, userId));
      } else if (customerId) {
        await setPlanByCustomer(customerId, plan);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const priceId = sub.items.data[0]?.price?.id;

      // Downgrade to free when the subscription is no longer in good standing.
      const plan = ACTIVE_STATUSES.has(sub.status) ? planForPrice(priceId) : "free";
      await setPlanByCustomer(customerId, plan);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await setPlanByCustomer(customerId, "free");
      break;
    }

    default:
      // Unhandled event types are acknowledged so Stripe stops retrying them.
      break;
  }

  return NextResponse.json({ received: true });
}

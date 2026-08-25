import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users } from "@/db";
import { stripe, PRICE_BY_PLAN } from "@/lib/stripe";

/**
 * Creates a Stripe Checkout session for the signed-in user and returns its URL.
 * The client redirects to it; Stripe handles the card details, so no payment
 * information ever touches this application.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, message: "Sign in first." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan;
  if (plan !== "paid" && plan !== "pro") {
    return NextResponse.json({ ok: false, message: "Unknown plan." }, { status: 400 });
  }

  const priceId = PRICE_BY_PLAN[plan];
  if (!priceId) {
    return NextResponse.json(
      { ok: false, message: `No Stripe price configured for "${plan}".` },
      { status: 500 }
    );
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) {
    return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
  }

  // Reuse the Stripe customer if we've made one before, so a returning
  // subscriber doesn't end up with duplicate customer records.
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
  }

  const origin = process.env.AUTH_URL ?? req.nextUrl.origin;

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/?upgraded=1`,
    cancel_url: `${origin}/`,
    // Echoed back on the webhook so we know which user to upgrade.
    client_reference_id: user.id,
    metadata: { userId: user.id, plan },
    subscription_data: { metadata: { userId: user.id, plan } },
  });

  return NextResponse.json({ ok: true, url: checkout.url });
}

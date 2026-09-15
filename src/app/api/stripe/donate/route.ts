import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";
import { DONATION_TIERS } from "@/lib/donations";

/**
 * One-off "buy me a coffee" payment.
 *
 * Deliberately does NOT require sign-in — a tip should never be gated behind
 * an account. Deliberately mode:"payment", not "subscription", and the webhook
 * ignores non-subscription sessions so this grants no plan.
 */

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { tier?: string };
  const tier = DONATION_TIERS.find((t) => t.id === body.tier);

  if (!tier) {
    return NextResponse.json(
      { ok: false, message: "Unknown donation amount." },
      { status: 400 }
    );
  }

  // Attach the user if there happens to be one, purely so thank-yous can be
  // matched to an account later. Anonymous tips are equally welcome.
  const session = await auth();
  const origin = process.env.AUTH_URL ?? req.nextUrl.origin;

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: tier.amount,
          product_data: {
            name: `TubeData — ${tier.label}`,
            description: "A one-off thank-you. Grants no subscription or premium access.",
          },
        },
      },
    ],
    /**
     * A TIP IS NOT A TAXABLE SUPPLY, so this session opts out of Managed
     * Payments rather than pretending a thank-you is a software licence.
     *
     * Managed Payments demands a tax code on every line item and accepts only
     * digital-supply codes — "Nontaxable" is explicitly rejected as ineligible.
     * The only two ways through are to tag a gratuity as SaaS and let Stripe
     * collect tax on it, or to take this one session out of the managed flow.
     * This is the second, and it also leaves donations behaving exactly as they
     * did before the account switch.
     */
    managed_payments: { enabled: false },
    success_url: `${origin}/?donated=1`,
    cancel_url: `${origin}/`,
    metadata: {
      kind: "donation",
      tier: tier.id,
      ...(session?.user?.id ? { userId: session.user.id } : {}),
    },
  });

  return NextResponse.json({ ok: true, url: checkout.url });
}

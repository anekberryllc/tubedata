import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { blockedMessage } from "@/lib/roles";
import { db, users } from "@/db";
import { stripe } from "@/lib/stripe";
import { getPack } from "@/lib/lookup-packs";

/**
 * One-time purchase of prepaid lookups.
 *
 * Requires sign-in — unlike a donation, this grants something that has to be
 * attached to an account and spent later. The pack is looked up server-side by
 * id, so the client never names a price or a credit amount.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, message: "Sign in first — credits are tied to your account." },
      { status: 401 }
    );
  }

  // Never charge an account that is not allowed to use what it would be
  // buying. Refusing at the door is far cheaper than the refund afterwards.
  if (session.user.blocked) {
    return NextResponse.json(
      { ok: false, message: blockedMessage(session.user.blockedReason) },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { pack?: string };
  const pack = getPack(body.pack ?? "");
  if (!pack) {
    return NextResponse.json({ ok: false, message: "Unknown pack." }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) {
    return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
  }

  // Reuse the Stripe customer so packs and subscriptions land on one record.
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
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.amount,
          product_data: {
            name: `${pack.credits} TubeData lookups`,
            description: "Prepaid lookups. Never expire. Used after your free daily allowance.",
          },
        },
      },
    ],
    success_url: `${origin}/?credits=${pack.credits}`,
    cancel_url: `${origin}/`,
    client_reference_id: user.id,
    // The webhook reads these to decide who to credit and by how much. It must
    // not trust anything the browser sends.
    metadata: {
      kind: "lookup_pack",
      packId: pack.id,
      credits: String(pack.credits),
      userId: user.id,
    },
  });

  return NextResponse.json({ ok: true, url: checkout.url });
}

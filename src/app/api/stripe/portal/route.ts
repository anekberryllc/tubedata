import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users } from "@/db";
import { stripe } from "@/lib/stripe";

/**
 * Stripe Customer Portal: lets subscribers update cards, view invoices, and
 * cancel without emailing you. Stripe hosts the whole thing.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { ok: false, message: "No billing account yet." },
      { status: 400 }
    );
  }

  const origin = process.env.AUTH_URL ?? req.nextUrl.origin;

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: origin,
  });

  return NextResponse.json({ ok: true, url: portal.url });
}

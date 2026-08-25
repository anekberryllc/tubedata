import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users, refundRequests } from "@/db";

/**
 * Refund requests.
 *
 * This endpoint records a request; it does NOT call stripe.refunds.create().
 * Moving money back is irreversible and warrants a human deciding, so the
 * request lands in a queue and the user is told it is being reviewed.
 */

const MAX_REASON = 2000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = (body.reason ?? "").trim();

  if (!reason) {
    return NextResponse.json(
      { ok: false, message: "Please tell us what went wrong." },
      { status: 400 }
    );
  }
  if (reason.length > MAX_REASON) {
    return NextResponse.json(
      { ok: false, message: `Please keep it under ${MAX_REASON} characters.` },
      { status: 400 }
    );
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) {
    return NextResponse.json({ ok: false, message: "User not found." }, { status: 404 });
  }

  // One open request at a time, so a frustrated click doesn't create a pile of
  // duplicates for whoever works the queue.
  const [existing] = await db
    .select({ id: refundRequests.id })
    .from(refundRequests)
    .where(and(eq(refundRequests.userId, user.id), eq(refundRequests.status, "open")))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        reason: "duplicate",
        message: "You already have a refund request open. We'll get back to you on that one.",
      },
      { status: 409 }
    );
  }

  const [created] = await db
    .insert(refundRequests)
    .values({
      userId: user.id,
      email: user.email,
      plan: user.plan,
      stripeCustomerId: user.stripeCustomerId,
      reason,
    })
    .returning({ id: refundRequests.id, createdAt: refundRequests.createdAt });

  return NextResponse.json({ ok: true, id: created.id, createdAt: created.createdAt });
}

/** The signed-in user's most recent request, so the page can show its status. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, message: "Sign in first." }, { status: 401 });
  }

  const [latest] = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.userId, session.user.id))
    .orderBy(desc(refundRequests.createdAt))
    .limit(1);

  return NextResponse.json({ ok: true, request: latest ?? null });
}

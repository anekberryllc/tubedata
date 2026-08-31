import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db, users, lookups, donations, creditPurchases, refundRequests } from "@/db";
import { stripe } from "./stripe";
import { listUsers, type AdminUser } from "./admin";

/**
 * Everything about ONE account, for the admin detail page.
 *
 * Split out of admin.ts because this is the only place that talks to Stripe,
 * and the user list — which loads on every visit to the panel — should not
 * drag a network call to a third party in behind it.
 *
 * Guarding is the caller's job, as it is everywhere in the admin code: these
 * functions answer whoever asks, and the page asks requireAdminPage() first.
 */

export type UserPurchase = {
  id: number;
  kind: "pack" | "tip";
  label: string;
  amountCents: number;
  createdAt: Date;
};

export type UserRefund = {
  id: number;
  status: string;
  reason: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type AdminUserDetail = AdminUser & {
  lookups7d: number;
  firstLookupAt: Date | null;
  /** Lookups served from our own cache — the ones that cost no YouTube quota. */
  cacheHits: number;
  quotaUnits: number;
  distinctVideos: number;
  /** Every IP this account has looked up from. */
  ips: string[];
  purchases: UserPurchase[];
  refunds: UserRefund[];
  /** Packs plus tips: what this person has actually paid us, one-off. */
  spentCents: number;
};

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  // Reuses listUsers so the badges and activity counts have exactly one
  // implementation. A detail page that disagreed with the list it was opened
  // from would be worse than no detail page at all.
  const base = (await listUsers()).find((u) => u.id === userId);
  if (!base) return null;

  const [agg] = await db
    .select({
      last7d: sql<number>`COUNT(*) FILTER (WHERE ${lookups.requestedAt} > now() - interval '7 days')::int`,
      firstAt: sql<string | null>`MIN(${lookups.requestedAt})`,
      cacheHits: sql<number>`COUNT(*) FILTER (WHERE ${lookups.cacheHit})::int`,
      quota: sql<number>`COALESCE(SUM(${lookups.quotaUnits}), 0)::int`,
      videos: sql<number>`COUNT(DISTINCT ${lookups.videoId})::int`,
    })
    .from(lookups)
    .where(eq(lookups.userId, userId));

  const ipRows = await db
    .selectDistinct({ ip: lookups.ipAddress })
    .from(lookups)
    .where(and(eq(lookups.userId, userId), isNotNull(lookups.ipAddress)))
    .limit(20);

  const packs = await db
    .select()
    .from(creditPurchases)
    .where(eq(creditPurchases.userId, userId))
    .orderBy(desc(creditPurchases.createdAt));

  const tips = await db
    .select()
    .from(donations)
    .where(eq(donations.userId, userId))
    .orderBy(desc(donations.createdAt));

  const refunds = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.userId, userId))
    .orderBy(desc(refundRequests.createdAt));

  // Packs and tips live in separate tables because they mean different things
  // — one grants credits, the other grants nothing, and that separation is
  // load-bearing in the webhook. Here the question is only "what has this
  // person paid us", so they merge into one ledger for display.
  const purchases: UserPurchase[] = [
    ...packs.map((p) => ({
      id: p.id,
      kind: "pack" as const,
      label: `${p.credits} lookups${p.packId ? ` (${p.packId})` : ""}`,
      amountCents: p.amountCents ?? 0,
      createdAt: p.createdAt,
    })),
    ...tips.map((d) => ({
      id: d.id,
      kind: "tip" as const,
      label: d.tierId ? `Tip — ${d.tierId}` : "Tip",
      amountCents: d.amountCents,
      createdAt: d.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    ...base,
    lookups7d: agg?.last7d ?? 0,
    firstLookupAt: agg?.firstAt ? new Date(agg.firstAt) : null,
    cacheHits: agg?.cacheHits ?? 0,
    quotaUnits: agg?.quota ?? 0,
    distinctVideos: agg?.videos ?? 0,
    ips: ipRows.map((r) => r.ip as string),
    purchases,
    refunds: refunds.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
    })),
    spentCents: purchases.reduce((sum, p) => sum + p.amountCents, 0),
  };
}

export type StripeSubscription = {
  id: string;
  status: string;
  priceId: string | null;
  interval: string | null;
  amountCents: number | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export type StripeSummary =
  | { ok: true; subscriptions: StripeSubscription[] }
  | { ok: false; message: string };

/**
 * The subscriptions Stripe currently holds for this customer.
 *
 * Read live rather than trusting our own `plan` column, ON PURPOSE. That
 * column is only as fresh as the last webhook we processed, and there is
 * still no registered webhook endpoint in production — so when the two
 * disagree, Stripe is the one that is right, and seeing the disagreement is
 * exactly what this section is for.
 *
 * Failure is returned, never thrown: Stripe being unreachable must not take
 * out a page that is otherwise entirely about our own database.
 */
export async function getStripeSummary(customerId: string): Promise<StripeSummary> {
  try {
    const list = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    return {
      ok: true,
      subscriptions: list.data.map((s) => {
        // current_period_end sits on the subscription ITEM in the API version
        // this SDK targets — it is no longer a field on the subscription.
        const item = s.items?.data?.[0];
        return {
          id: s.id,
          status: s.status,
          priceId: item?.price?.id ?? null,
          interval: item?.price?.recurring?.interval ?? null,
          amountCents: item?.price?.unit_amount ?? null,
          currentPeriodEnd: item?.current_period_end
            ? new Date(item.current_period_end * 1000)
            : null,
          cancelAtPeriodEnd: s.cancel_at_period_end,
        };
      }),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not reach Stripe.",
    };
  }
}

/** Used by the detail page to resolve who blocked this account. */
export async function getUserLabel(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.email ?? row?.name ?? null;
}

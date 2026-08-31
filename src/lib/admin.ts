import { notFound } from "next/navigation";
import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users, lookups, videos, donations, creditPurchases, refundRequests } from "@/db";
import { isAdmin, type Role } from "./roles";
import { looseSearch } from "./search";
import type { Plan } from "./plans";

/**
 * Everything the admin panel needs, and the guard that protects it.
 *
 * The guard is repeated in every entry point rather than hoisted into
 * middleware on purpose: middleware would have to run on the edge, where the
 * database session cannot be read, and a panel that is only hidden by
 * navigation is not protected at all. Each page and each server action asks
 * again, so there is no route into this data that skips the check.
 */

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: Role;
  plan: Plan;
  credits: number;
  stripeCustomerId: string | null;
  blockedAt: Date | null;
  blockedReason: string | null;
  blockedBy: string | null;
  /** Lookups this account has made while signed in, all time. */
  lookups: number;
  lookups24h: number;
  lastLookupAt: Date | null;
};

/**
 * Page guard. Answers 404, not 403: a stranger poking at /admin learns only
 * that there is nothing there, which is the correct amount of information.
 */
export async function requireAdminPage() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role) || session.user.blocked) {
    notFound();
  }
  return session.user;
}

/**
 * Action guard. Server actions are a public HTTP surface — anyone who can
 * guess the action id can invoke it — so every one of them re-checks here
 * rather than trusting that the page rendered for an admin.
 *
 * Returns null instead of throwing so callers can answer with a message.
 */
export async function currentAdmin() {
  const session = await auth();
  if (!session?.user?.id || !isAdmin(session.user.role) || session.user.blocked) {
    return null;
  }
  return session.user;
}

export type AdminOverview = {
  users: number;
  admins: number;
  blocked: number;
  pro: number;
  lookupsTotal: number;
  lookups24h: number;
  lookupsSignedIn: number;
  quotaTotal: number;
  quota24h: number;
  videosCached: number;
  purchases: number;
  purchaseCents: number;
  donations: number;
  donationCents: number;
  openRefunds: number;
};

/** Site-wide counters for the top of the panel. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const day = sql`now() - interval '24 hours'`;

  const [u] = await db
    .select({
      users: sql<number>`COUNT(*)::int`,
      admins: sql<number>`COUNT(*) FILTER (WHERE ${users.role} = 'admin')::int`,
      blocked: sql<number>`COUNT(*) FILTER (WHERE ${users.blockedAt} IS NOT NULL)::int`,
      pro: sql<number>`COUNT(*) FILTER (WHERE ${users.plan} = 'pro')::int`,
    })
    .from(users);

  const [l] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      last24h: sql<number>`COUNT(*) FILTER (WHERE ${lookups.requestedAt} > ${day})::int`,
      signedIn: sql<number>`COUNT(*) FILTER (WHERE ${lookups.userId} IS NOT NULL)::int`,
      quota: sql<number>`COALESCE(SUM(${lookups.quotaUnits}), 0)::int`,
      quota24h: sql<number>`COALESCE(SUM(${lookups.quotaUnits}) FILTER (WHERE ${lookups.requestedAt} > ${day}), 0)::int`,
    })
    .from(lookups);

  const [v] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(videos);

  const [p] = await db
    .select({
      n: sql<number>`COUNT(*)::int`,
      cents: sql<number>`COALESCE(SUM(${creditPurchases.amountCents}), 0)::int`,
    })
    .from(creditPurchases);

  const [d] = await db
    .select({
      n: sql<number>`COUNT(*)::int`,
      cents: sql<number>`COALESCE(SUM(${donations.amountCents}), 0)::int`,
    })
    .from(donations);

  const [r] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(refundRequests)
    .where(eq(refundRequests.status, "open"));

  return {
    users: u?.users ?? 0,
    admins: u?.admins ?? 0,
    blocked: u?.blocked ?? 0,
    pro: u?.pro ?? 0,
    lookupsTotal: l?.total ?? 0,
    lookups24h: l?.last24h ?? 0,
    lookupsSignedIn: l?.signedIn ?? 0,
    quotaTotal: l?.quota ?? 0,
    quota24h: l?.quota24h ?? 0,
    videosCached: v?.n ?? 0,
    purchases: p?.n ?? 0,
    purchaseCents: p?.cents ?? 0,
    donations: d?.n ?? 0,
    donationCents: d?.cents ?? 0,
    openRefunds: r?.n ?? 0,
  };
}

/**
 * Every user, with their lookup activity merged in.
 *
 * Two queries and a join in JavaScript rather than one SQL LEFT JOIN with a
 * GROUP BY over the whole users table: the aggregate is over `lookups`, which
 * is by far the larger table, and this way it is scanned once regardless of
 * the search term. At TubeData's user count either shape is instant; this one
 * stays honest as the lookups table grows.
 */
export async function listUsers(query?: string): Promise<AdminUser[]> {
  const q = query?.trim();

  const rows = await db
    .select()
    .from(users)
    // Same loose matching as every other search box, so "obrien" finds
    // "O'Brien" here exactly as "dont" finds "Don't" in a video title.
    .where(q ? looseSearch(q, [users.email, users.name]) : undefined)
    // Blocked accounts first (they are why you opened the page), then admins,
    // then everyone alphabetically.
    //
    // Ordered on booleans rather than on the columns themselves, because both
    // obvious spellings are wrong: DESC on blockedAt puts NULLs FIRST in
    // Postgres, which is every ACTIVE account, and DESC on role sorts 'member'
    // above 'admin'. "true first" says what is meant and cannot drift.
    .orderBy(
      sql`(${users.blockedAt} IS NOT NULL) DESC`,
      sql`(${users.role} = 'admin') DESC`,
      asc(users.email)
    );

  const activity = await db
    .select({
      userId: lookups.userId,
      total: sql<number>`COUNT(*)::int`,
      last24h: sql<number>`COUNT(*) FILTER (WHERE ${lookups.requestedAt} > now() - interval '24 hours')::int`,
      lastAt: sql<string | null>`MAX(${lookups.requestedAt})`,
    })
    .from(lookups)
    .where(isNotNull(lookups.userId))
    .groupBy(lookups.userId);

  const byUser = new Map(activity.map((a) => [a.userId as string, a]));

  return rows.map((r) => {
    const a = byUser.get(r.id);
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      image: r.image,
      role: (r.role === "admin" ? "admin" : "member") as Role,
      plan: (r.plan === "pro" ? "pro" : "free") as Plan,
      credits: r.lookupCredits,
      stripeCustomerId: r.stripeCustomerId,
      blockedAt: r.blockedAt ?? null,
      blockedReason: r.blockedReason ?? null,
      blockedBy: r.blockedBy ?? null,
      lookups: a?.total ?? 0,
      lookups24h: a?.last24h ?? 0,
      lastLookupAt: a?.lastAt ? new Date(a.lastAt) : null,
    };
  });
}

/** How many admins are left. Used to refuse the change that locks everyone out. */
export async function countAdmins(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));
  return row?.n ?? 0;
}

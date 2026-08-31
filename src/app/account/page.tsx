import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users, refundRequests } from "@/db";
import { PLAN_LABELS, isPro, hasProAccess, type Plan } from "@/lib/plans";
import { LoginButton } from "@/components/AuthDialog";
import { ManageSubscription } from "@/components/ManageSubscription";
import { RefundRequestForm } from "@/components/RefundRequestForm";
import { UpgradeButton } from "@/components/UpgradeButton";
import {
  formatUsd,
  PRO_PRICE_CENTS,
  ANNUAL_SAVING_PERCENT,
  ANNUAL_MONTHLY_EQUIVALENT_CENTS,
} from "@/lib/pricing";
import { BuyLookups } from "@/components/BuyLookups";
import {
  FREE_DAILY_LOOKUPS,
  PRO_ALLOWANCE_LABEL,
  PRO_MONTHLY_LOOKUPS,
  formatLookups,
} from "@/lib/limits";
import { PurchaseHistory } from "@/components/PurchaseHistory";

export const metadata: Metadata = {
  title: "Manage account",
  description: "Your plan, subscription, and billing.",
};

// Reads the session, so it must never be cached or statically rendered.
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Manage account</h1>
        <div className="mt-8 space-y-10">{children}</div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <Shell>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-slate-400">Sign in to manage your account.</p>
          <div className="mt-5 flex justify-center">
            <LoginButton />
          </div>
        </div>
      </Shell>
    );
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  const plan = (user?.plan ?? "free") as Plan;

  // Two different questions on this page, and conflating them breaks it:
  //   pro    — what this account is BILLED. Drives the subscription controls,
  //            because the Stripe portal has nothing to show without one.
  //   access — what this account can DO. Admins have everything without paying.
  const pro = isPro(plan);
  const access = hasProAccess(user?.plan, user?.role);
  const proViaAdmin = access && !pro;

  // Anyone who has ever been billed can ask for a refund, including someone who
  // has already cancelled — that is exactly when people ask.
  const everPaid = !!user?.stripeCustomerId;

  const [latestRefund] = everPaid
    ? await db
        .select()
        .from(refundRequests)
        .where(eq(refundRequests.userId, session.user.id))
        .orderBy(desc(refundRequests.createdAt))
        .limit(1)
    : [];

  return (
    <Shell>
      <Section title="Plan">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
              pro
                ? "bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-200 ring-1 ring-amber-400/30"
                : "bg-white/5 text-slate-400 ring-1 ring-white/10"
            }`}
          >
            {PLAN_LABELS[plan]}
          </span>

          <div className="min-w-[12rem] flex-1">
            <p className="text-sm text-slate-300">
              {proViaAdmin
                ? "Everything is unlocked, with no lookup cap."
                : access
                  ? `${PRO_ALLOWANCE_LABEL} and your full lookup history are unlocked.`
                  : `You're on the free plan. Every field is free; lookups are capped at ${FREE_DAILY_LOOKUPS} per day and history is not saved for you to browse.`}
            </p>
            {proViaAdmin && (
              <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
                Unlocked by your admin role, not by a subscription — nothing is being
                billed to you.
              </p>
            )}
            {user?.email && (
              <p className="mt-0.5 truncate text-xs text-slate-600">{user.email}</p>
            )}
          </div>
        </div>
      </Section>

      <Section title="Subscription">
        {pro ? (
          <ManageSubscription />
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            {proViaAdmin ? (
              // No upgrade pitch to someone who already has everything — it
              // would read as a demand for money for access they already hold.
              <p className="text-sm text-slate-400">
                No subscription, and you don&rsquo;t need one: admin accounts have full
                access. If your role is ever removed, this account drops back to the
                free plan.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-400">
                  No subscription yet. Pro gives you {PRO_ALLOWANCE_LABEL} instead of{" "}
                  {FREE_DAILY_LOOKUPS} a day, and your saved lookup history.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <UpgradeButton
                    interval="year"
                    label={`Upgrade to Pro — ${formatUsd(PRO_PRICE_CENTS.year)}/yr`}
                    className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
                  />
                  <UpgradeButton
                    interval="month"
                    label={`or ${formatUsd(PRO_PRICE_CENTS.month)}/mo`}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                  />
                </div>
                <p className="mt-2.5 text-xs text-slate-500">
                  Yearly saves {ANNUAL_SAVING_PERCENT}% —{" "}
                  {formatUsd(ANNUAL_MONTHLY_EQUIVALENT_CENTS)}/mo, billed once a year.
                  Same Pro either way; you can switch later from the billing portal.
                </p>
              </>
            )}

            {/* Having a Stripe CUSTOMER is not having a subscription: buying a
                lookup pack creates one, and so does a subscription that was
                later cancelled. Keying the portal off it is right — those
                receipts exist and must stay reachable. Keying the UPGRADE off
                it was the bug: one $3 pack, or one cancellation, hid the way
                back to Pro forever. */}
            {everPaid && (
              <div className="mt-5 border-t border-white/[0.07] pt-4">
                <ManageSubscription
                  label="Billing & invoices"
                  note="Opens Stripe, where you can download past receipts and update your card."
                />
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Prepaid lookups">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          {proViaAdmin ? (
            <p className="text-sm text-slate-400">
              Your admin account has no lookup cap, so there is nothing to buy.
              {(user?.lookupCredits ?? 0) > 0 && (
                <>
                  {" "}
                  You still have{" "}
                  <span className="font-semibold text-sky-300">{user!.lookupCredits}</span>{" "}
                  prepaid lookups saved — they never expire and will be there if you cancel.
                </>
              )}
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-300">
                Balance:{" "}
                <span className="font-semibold text-sky-300">{user?.lookupCredits ?? 0}</span>{" "}
                prepaid {(user?.lookupCredits ?? 0) === 1 ? "lookup" : "lookups"}
              </p>
              {/* Since Pro was capped, a subscriber can exhaust their month and
                  buy more rather than wait for the 1st — so this section is no
                  longer free-tier-only. */}
              <p className="mt-1 text-xs text-slate-600">
                Spent only after your{" "}
                {pro
                  ? `${formatLookups(PRO_MONTHLY_LOOKUPS)} monthly`
                  : `${FREE_DAILY_LOOKUPS} free daily`}{" "}
                lookups run out. They never expire.
              </p>
              <div className="mt-4">
                <BuyLookups />
              </div>
            </>
          )}
        </div>
      </Section>

      <Section title="Purchase history">
        <PurchaseHistory
          userId={session.user.id}
          stripeCustomerId={user?.stripeCustomerId ?? null}
        />
      </Section>

      {everPaid && (
        <Section title="Refunds">
          <RefundRequestForm
            existing={
              latestRefund
                ? {
                    id: latestRefund.id,
                    status: latestRefund.status,
                    reason: latestRefund.reason,
                    createdAt: latestRefund.createdAt.toISOString(),
                  }
                : null
            }
          />
        </Section>
      )}

      <Section title="Your data">
        <Link
          href="/history"
          className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition hover:border-sky-400/30 hover:bg-sky-400/[0.04]"
        >
          <span className="text-sm text-slate-300">Lookup history</span>
          <span aria-hidden="true" className="text-slate-600">
            →
          </span>
        </Link>
      </Section>
    </Shell>
  );
}

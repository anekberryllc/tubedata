import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { hasProAccess, isPro, type Plan } from "@/lib/plans";
import { ProCheckout } from "@/components/ProCheckout";
import { BuyLookups } from "@/components/BuyLookups";
import { LOOKUP_PACKS } from "@/lib/lookup-packs";
import { formatUsd, PRO_PRICE_CENTS } from "@/lib/pricing";
import {
  FREE_DAILY_LOOKUPS,
  PRO_ALLOWANCE_LABEL,
  PRO_MONTHLY_LOOKUPS,
  formatLookups,
} from "@/lib/limits";
import { SUPPORT_EMAIL } from "@/lib/support";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    `Every field is free for everyone. Free gives you ${FREE_DAILY_LOOKUPS} lookups a ` +
    `day; Pro is ${formatUsd(PRO_PRICE_CENTS.month)}/mo for ${PRO_ALLOWANCE_LABEL} and ` +
    "your saved lookup history. Prepaid packs if you would rather not subscribe.",
  alternates: { canonical: "/pricing" },
};

/**
 * The pricing page.
 *
 * Reads the session, so it must never be statically rendered — and it changes
 * shape three ways, which is the whole reason it is a server component:
 *
 *   signed out / free   the full pitch
 *   Pro                 no pitch at all. Selling Pro to a Pro subscriber is a
 *                       mistake the rate-limit banner already had to fix once.
 *   admin               nothing to buy; the access comes from the role, and
 *                       asking for money for it would be nonsense.
 *
 * EVERY NUMBER HERE IS READ FROM limits.ts AND pricing.ts. Nothing is written
 * down twice — a price typed into this file is a price that starts lying the
 * day the real one changes.
 */
export const dynamic = "force-dynamic";

/** A line in a plan card. `no` marks something the tier does NOT include. */
function Feature({ children, no = false }: { children: React.ReactNode; no?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed">
      <span
        aria-hidden="true"
        className={`mt-0.5 text-xs ${no ? "text-slate-700" : "text-emerald-400"}`}
      >
        {no ? "—" : "✓"}
      </span>
      <span className={no ? "text-slate-600" : "text-slate-300"}>{children}</span>
    </li>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/[0.07] py-5">
      <h3 className="text-sm font-medium text-slate-200">{q}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{children}</p>
    </div>
  );
}

export default async function PricingPage() {
  const session = await auth();
  const user = session?.user;
  const plan = (user?.plan ?? "free") as Plan;

  // Billed vs entitled — the same split the account page draws, and for the
  // same reason: an admin has Pro access with no subscription behind it.
  const pro = isPro(plan);
  const access = hasProAccess(user?.plan, user?.role);
  const proViaAdmin = access && !pro;

  /**
   * One definition, rendered in two places: inside ProCheckout when there is
   * something to sell, and on its own when there is not. Written out twice it
   * would drift the first time a feature changed.
   */
  const proFeatures = (
    <ul className="mt-7 space-y-3">
      <Feature>
        <span className="font-medium text-slate-200">{PRO_ALLOWANCE_LABEL}</span> — a
        hundred times the free allowance
      </Feature>
      <Feature>Lookup history: every video you check, saved and browsable</Feature>
      <Feature>Everything in Free, unchanged</Feature>
      <Feature>Top up with prepaid lookups if you finish the month early</Feature>
    </ul>
  );

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-16">
        <div className="text-center">
          <h1 className="text-balance bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-4xl font-bold leading-[1.1] tracking-tight text-transparent sm:text-5xl">
            Simple pricing
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-slate-400">
            Every field TubeData can read is free for everyone — tags, topic categories,
            thumbnails, statistics history, raw JSON. What you pay for is how many videos
            you can look up, and whether we keep your history.
          </p>
        </div>

        {/* ---------- PLANS ---------- */}
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {/* ----- FREE ----- */}
          <div className="flex flex-col rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-100">Free</h2>
              {!access && (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 ring-1 ring-white/10">
                  Your plan
                </span>
              )}
            </div>

            <div className="mt-5 flex items-end gap-1.5">
              <span className="text-4xl font-bold tracking-tight text-white">$0</span>
              <span className="pb-1 text-sm text-slate-500">forever</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">No account needed. No card, ever.</p>

            <ul className="mt-7 space-y-3">
              <Feature>
                <span className="font-medium text-slate-200">
                  {FREE_DAILY_LOOKUPS} lookups a day
                </span>
                , resetting on a rolling 24 hours
              </Feature>
              <Feature>Every field on the result — nothing blurred or held back</Feature>
              <Feature>Estimated earnings range for any video</Feature>
              <Feature>The tag &amp; hashtag generator, free and unmetered</Feature>
              <Feature no>Lookup history you can browse</Feature>
            </ul>

            <div className="mt-auto pt-7">
              <Link
                href="/"
                className="block w-full rounded-xl border border-white/10 px-4 py-2.5 text-center text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
              >
                Look up a video
              </Link>
            </div>
          </div>

          {/* ----- PRO ----- */}
          <div className="relative flex flex-col rounded-3xl border border-amber-400/25 bg-gradient-to-b from-amber-400/[0.06] to-transparent p-7">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-100">Pro</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                  access
                    ? "bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-200 ring-1 ring-amber-400/30"
                    : "bg-amber-400/10 text-amber-200/80 ring-1 ring-amber-400/20"
                }`}
              >
                {pro ? "Your plan" : proViaAdmin ? "Admin access" : "Most useful"}
              </span>
            </div>

            {pro || proViaAdmin ? (
              <>
                {proFeatures}
                <div className="mt-auto pt-7">
                  {pro ? (
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-center">
                      <p className="text-sm text-slate-300">
                        You&rsquo;re on Pro. Nothing to buy here.
                      </p>
                      <Link
                        href="/account"
                        className="mt-3 inline-block rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
                      >
                        Manage subscription
                      </Link>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                      <p className="text-sm leading-relaxed text-slate-400">
                        Your admin role already unlocks all of this, with no lookup cap
                        and nothing billed. If the role is ever removed, this account
                        drops back to Free.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <ProCheckout>{proFeatures}</ProCheckout>
            )}
          </div>
        </div>

        {/* ---------- PACKS ---------- */}
        <div className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
            <div className="min-w-[16rem] flex-1">
              <h2 className="text-lg font-semibold text-slate-100">Or pay as you go</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                Prepaid lookups, no subscription. They never expire, and they are only
                spent once your included allowance runs out — so buying a pack never
                wastes a free lookup.
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Pro is cheaper per lookup ({formatLookups(PRO_MONTHLY_LOOKUPS)} for{" "}
                {formatUsd(PRO_PRICE_CENTS.month)} a month). Packs cost more each and
                exist so you don&rsquo;t have to commit to anything.
              </p>
            </div>

            {/* NOT shrink-0. BuyLookups lays its packs out with flex-wrap, and
                shrink-0 pinned this column at the full un-wrapped width of all
                three buttons — which overflowed the page horizontally on a
                phone. min-w-0 lets it narrow so that wrapping can happen. */}
            <div className="min-w-0">
              <BuyLookups />
              <p className="mt-2.5 text-[11px] text-slate-600">
                {LOOKUP_PACKS.length} sizes · one-off payment · needs an account
              </p>
            </div>
          </div>
        </div>

        {/* ---------- FAQ ---------- */}
        <div className="mt-16">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
            Before you pay
          </h2>

          <div className="mt-2">
            <Faq q="What counts as a lookup?">
              Every video you look up, including one already in our cache. A cached result
              costs us nothing, but counting it anyway keeps your allowance predictable —
              otherwise popular videos would be free and obscure ones would not, with no
              way for you to tell which is which beforehand.
            </Faq>

            <Faq q="Is anything on the result hidden unless I pay?">
              No. Tags, topic categories, every thumbnail size, region restrictions,
              statistics history, the estimated earnings range and the raw JSON are shown
              to everyone, signed in or not. Paying changes how many lookups you get, not
              what a lookup returns.
            </Faq>

            <Faq q="Is tax included in these prices?">
              No — prices here are before tax. Stripe works out sales tax from the
              address you enter at checkout and adds it on top, so the exact total is
              shown before you confirm, never after. How much it is (and whether there
              is any at all) depends on where you are.
            </Faq>

            <Faq q="What happens when I run out?">
              On Free, your {FREE_DAILY_LOOKUPS} come back on a rolling 24-hour window and
              the page tells you exactly when the next one unlocks. On Pro, the{" "}
              {formatLookups(PRO_MONTHLY_LOOKUPS)} reset at the start of each calendar
              month. Either way, prepaid lookups let you keep going now.
            </Faq>

            <Faq q="Do prepaid lookups expire?">
              Never. They sit on your account until they are used — including after a Pro
              subscription is cancelled.
            </Faq>

            <Faq q="Can I cancel?">
              Any time, from Manage account. It opens the Stripe billing portal, where you
              can also change your card and download invoices. Pro runs to the end of the
              period you have already paid for.
            </Faq>

            <Faq q="Can I get a refund?">
              Ask and a person reads it — refunds are reviewed, never automatic. Request
              one from Manage account, or email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-sky-300 underline-offset-4 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </Faq>
          </div>
        </div>
      </div>
    </main>
  );
}

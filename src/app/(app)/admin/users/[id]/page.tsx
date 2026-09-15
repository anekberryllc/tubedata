import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin";
import {
  getUserDetail,
  getStripeSummary,
  getUserLabel,
  type StripeSubscription,
} from "@/lib/admin-user";
import { searchLookups } from "@/lib/admin-lookups";
import { ACTIVE_STATUSES, planForPrice } from "@/lib/stripe";
import { PLAN_LABELS } from "@/lib/plans";
import {
  FREE_DAILY_LOOKUPS,
  PRO_MONTHLY_LOOKUPS,
  formatLookups,
} from "@/lib/limits";
import { ROLE_LABELS } from "@/lib/roles";
import { formatUsd } from "@/lib/pricing";
import { AdminNav } from "../../AdminNav";
import { LookupTable } from "../../LookupTable";
import { AdminUserControls } from "../../AdminUserControls";

export const metadata: Metadata = {
  title: "User",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const RECENT_LOOKUPS = 50;

const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

const num = (n: number) => n.toLocaleString("en-US");

/**
 * What a subscription's period end MEANS depends on its status.
 *
 * On a cancelled subscription that date is when access stopped, so labelling
 * it "Renews" — as it would be if this only looked at cancel_at_period_end,
 * which is false once the cancellation has actually happened — makes a lapsed
 * customer read as a current one.
 */
function periodLabel(s: StripeSubscription) {
  if (!ACTIVE_STATUSES.has(s.status)) return "Ended";
  return s.cancelAtPeriodEnd ? "Access ends" : "Renews";
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-slate-100">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.05] px-4 py-2.5 last:border-0">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className="text-[13px] text-slate-200">{children}</span>
    </div>
  );
}

export default async function AdminUserPage(props: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdminPage();
  const { id } = await props.params;

  const user = await getUserDetail(id);
  if (!user) notFound();

  // Fetched together: the Stripe call is a network round trip and the lookups
  // are a database one, and neither needs the other's answer.
  const [stripeSummary, recent, blockedByLabel] = await Promise.all([
    user.stripeCustomerId ? getStripeSummary(user.stripeCustomerId) : null,
    searchLookups({ userId: user.id, perPage: RECENT_LOOKUPS }),
    user.blockedBy ? getUserLabel(user.blockedBy) : null,
  ]);

  // What Stripe says, versus what our own column says. They can legitimately
  // differ for a few seconds after a change; a lasting difference means a
  // webhook was missed, which is worth seeing rather than smoothing over.
  const liveSubs = stripeSummary?.ok ? stripeSummary.subscriptions : [];
  const stripeSaysPro = liveSubs.some(
    (s) => ACTIVE_STATUSES.has(s.status) && planForPrice(s.priceId) === "pro"
  );
  const columnSaysPro = user.plan === "pro";
  const planMismatch = !!stripeSummary?.ok && stripeSaysPro !== columnSaysPro;

  const label = user.email ?? user.name ?? user.id;
  const cacheRate =
    user.lookups > 0 ? Math.round((user.cacheHits / user.lookups) * 100) : 0;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-16">
        <Link
          href="/admin"
          className="text-[13px] text-slate-500 transition hover:text-slate-300"
        >
          ← All users
        </Link>

        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-xl font-bold text-slate-950">
                {label.trim().charAt(0).toUpperCase()}
              </span>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-slate-100">
                {user.name ?? "No name"}
              </h1>
              <p className="mt-0.5 truncate text-sm text-slate-500">
                {user.email ?? "No email on file"}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${
                    user.role === "admin"
                      ? "bg-amber-400/15 text-amber-200 ring-amber-400/30"
                      : "bg-white/5 text-slate-400 ring-white/10"
                  }`}
                >
                  {ROLE_LABELS[user.role]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${
                    columnSaysPro
                      ? "bg-gradient-to-r from-sky-400/20 to-indigo-400/20 text-sky-200 ring-sky-400/30"
                      : "bg-white/5 text-slate-400 ring-white/10"
                  }`}
                >
                  {PLAN_LABELS[user.plan]}
                </span>
                {user.blockedAt && (
                  <span className="rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-red-200 ring-1 ring-red-400/30">
                    Blocked
                  </span>
                )}
                {user.id === admin.id && (
                  <span className="text-[10px] uppercase tracking-[0.1em] text-slate-600">
                    you
                  </span>
                )}
              </div>
            </div>
          </div>

          <AdminUserControls
            userId={user.id}
            label={label}
            role={user.role}
            blocked={!!user.blockedAt}
            isSelf={user.id === admin.id}
          />
        </div>

        {user.blockedAt && (
          <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/[0.05] p-4">
            <p className="text-[13px] font-medium text-red-200">
              Blocked {when.format(user.blockedAt)} ET
              {blockedByLabel ? ` by ${blockedByLabel}` : ""}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-300">
              {user.blockedReason ?? "No reason recorded."}
            </p>
          </div>
        )}

        <Section title="Access">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-1">
            <Row label="Plan (our database)">{PLAN_LABELS[user.plan]}</Row>
            <Row label="Role">{ROLE_LABELS[user.role]}</Row>
            <Row label="Prepaid lookups">
              <span className="tabular-nums">{num(user.credits)}</span>
            </Row>
            <Row label="Lookup cap">
              {user.role === "admin"
                ? "Uncapped (admin)"
                : columnSaysPro
                  ? `${formatLookups(PRO_MONTHLY_LOOKUPS)} a month, this account`
                  : `${FREE_DAILY_LOOKUPS} a day, by IP`}
            </Row>
            <Row label="Stripe customer">
              {user.stripeCustomerId ? (
                <span className="font-mono text-[12px] text-slate-400">
                  {user.stripeCustomerId}
                </span>
              ) : (
                <span className="text-slate-600">never billed</span>
              )}
            </Row>
            <Row label="User id">
              <span className="font-mono text-[12px] text-slate-500">{user.id}</span>
            </Row>
          </div>
        </Section>

        <Section title="Subscription — live from Stripe">
          {!user.stripeCustomerId ? (
            <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-sm text-slate-500">
              This account has never been through checkout, so Stripe has no customer
              record for it.
            </p>
          ) : stripeSummary && !stripeSummary.ok ? (
            <p className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.05] p-5 text-sm text-amber-200">
              Couldn&rsquo;t reach Stripe: {stripeSummary.message}
            </p>
          ) : liveSubs.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-sm text-slate-500">
              A Stripe customer exists, but has no subscriptions — one-off purchases
              only.
            </p>
          ) : (
            <>
              {planMismatch && (
                <p className="mb-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-[13px] leading-relaxed text-amber-200">
                  Stripe and our database disagree: Stripe says this account{" "}
                  {stripeSaysPro ? "should be Pro" : "should not be Pro"}, our{" "}
                  <code>plan</code> column says {PLAN_LABELS[user.plan]}. That is what a
                  missed webhook looks like.
                </p>
              )}
              <ul className="space-y-2.5">
                {liveSubs.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${
                          ACTIVE_STATUSES.has(s.status)
                            ? "bg-emerald-400/10 text-emerald-200 ring-emerald-400/25"
                            : "bg-white/5 text-slate-400 ring-white/10"
                        }`}
                      >
                        {s.status}
                      </span>
                      {s.amountCents !== null && (
                        <span className="text-[13px] text-slate-200">
                          {formatUsd(s.amountCents)}
                          {s.interval ? ` / ${s.interval}` : ""}
                        </span>
                      )}
                      {s.cancelAtPeriodEnd && (
                        <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-200 ring-1 ring-amber-400/25">
                          cancels at period end
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[12px] text-slate-500">
                      {s.currentPeriodEnd
                        ? `${periodLabel(s)} ${when.format(s.currentPeriodEnd)} ET · `
                        : ""}
                      <span className="font-mono">{s.id}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        <Section title="Payments">
          {user.purchases.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-sm text-slate-500">
              No one-off purchases or tips from this account.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[13px] text-slate-400">
                {formatUsd(user.spentCents)} across {num(user.purchases.length)}{" "}
                {user.purchases.length === 1 ? "payment" : "payments"} — excluding
                subscription invoices, which live in Stripe.
              </p>
              <ul className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-1">
                {user.purchases.map((p) => (
                  <li
                    key={`${p.kind}-${p.id}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.05] px-4 py-2.5 last:border-0"
                  >
                    <span className="text-[13px] text-slate-300">
                      <span
                        className={`mr-2 rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.1em] ${
                          p.kind === "tip"
                            ? "bg-pink-400/10 text-pink-200"
                            : "bg-sky-400/10 text-sky-200"
                        }`}
                      >
                        {p.kind}
                      </span>
                      {p.label}
                    </span>
                    <span className="text-[13px] tabular-nums text-slate-200">
                      {formatUsd(p.amountCents)}
                      <span className="ml-3 text-[11px] text-slate-600">
                        {when.format(p.createdAt)} ET
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>

        {user.refunds.length > 0 && (
          <Section title="Refund requests">
            <ul className="space-y-2.5">
              {user.refunds.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${
                        r.status === "open"
                          ? "bg-amber-400/10 text-amber-200 ring-amber-400/25"
                          : "bg-white/5 text-slate-400 ring-white/10"
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="text-[11px] text-slate-600">
                      asked {when.format(r.createdAt)} ET
                      {r.resolvedAt ? ` · resolved ${when.format(r.resolvedAt)} ET` : ""}
                    </span>
                  </div>
                  {r.reason && (
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
                      {r.reason}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Activity">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Lookups" value={num(user.lookups)} hint="all time" />
            <Stat label="Last 24h" value={num(user.lookups24h)} />
            <Stat label="Last 7 days" value={num(user.lookups7d)} />
            <Stat
              label="Distinct videos"
              value={num(user.distinctVideos)}
              hint={`${cacheRate}% served from cache`}
            />
          </div>
          <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] py-1">
            <Row label="First lookup">
              {user.firstLookupAt ? `${when.format(user.firstLookupAt)} ET` : "never"}
            </Row>
            <Row label="Last lookup">
              {user.lastLookupAt ? `${when.format(user.lastLookupAt)} ET` : "never"}
            </Row>
            <Row label="YouTube quota used">
              <span className="tabular-nums">{num(user.quotaUnits)} units</span>
            </Row>
            <Row label="IP addresses">
              {user.ips.length ? (
                <span className="font-mono text-[12px] text-slate-400">
                  {user.ips.join(", ")}
                </span>
              ) : (
                <span className="text-slate-600">none recorded</span>
              )}
            </Row>
          </div>
        </Section>

        <Section
          title="Lookup history"
          action={
            user.lookups > RECENT_LOOKUPS ? (
              <Link
                href={`/admin/lookups?user=${user.id}`}
                className="text-[13px] text-sky-300 underline-offset-2 hover:underline"
              >
                See all {num(user.lookups)} →
              </Link>
            ) : null
          }
        >
          <p className="mb-3 text-xs text-slate-500">
            {user.lookups === 0
              ? "This account has never looked up a video."
              : `Most recent ${Math.min(user.lookups, RECENT_LOOKUPS)} of ${num(user.lookups)}, newest first.`}
          </p>
          <LookupTable rows={recent.rows} showUser={false} />
        </Section>

        <AdminNav current="overview" />
      </div>
    </main>
  );
}

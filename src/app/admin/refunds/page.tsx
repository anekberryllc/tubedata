import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { listRefunds, countRefundsByStatus } from "@/lib/admin-refunds";
import { REFUND_STATUSES, isRefundStatus } from "@/lib/refund-status";
import { PLAN_LABELS, type Plan } from "@/lib/plans";
import { AdminNav } from "../AdminNav";
import { RefundActions } from "../RefundActions";
import { IssueRefund } from "../IssueRefund";

export const metadata: Metadata = {
  title: "Refunds",
  description: "Refund requests awaiting a decision.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

const TONE: Record<string, string> = {
  open: "bg-amber-400/15 text-amber-200 ring-amber-400/30",
  approved: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30",
  refunded: "bg-sky-400/15 text-sky-200 ring-sky-400/30",
  declined: "bg-red-400/15 text-red-200 ring-red-400/30",
};

export default async function AdminRefundsPage(props: PageProps<"/admin/refunds">) {
  await requireAdminPage();

  const sp = await props.searchParams;
  const filter = typeof sp.status === "string" && isRefundStatus(sp.status) ? sp.status : "";

  const [requests, counts] = await Promise.all([
    listRefunds(filter || undefined),
    countRefundsByStatus(),
  ]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const tab = (value: string, label: string, count: number) => (
    <Link
      key={value || "all"}
      href={value ? `/admin/refunds?status=${value}` : "/admin/refunds"}
      className={`rounded-lg px-3 py-1.5 text-[13px] transition ${
        filter === value
          ? "bg-white/[0.08] font-medium text-slate-100"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
      }`}
    >
      {label}
      <span className="ml-1.5 tabular-nums text-slate-600">{count}</span>
    </Link>
  );

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Refunds</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Every refund request, newest first. The status is what the requester sees
          on their account page.{" "}
          <span className="text-slate-300">
            &ldquo;Refund money&rdquo; sends real money back through Stripe and cannot be
            undone.
          </span>
        </p>

        <AdminNav current="refunds" />

        <div className="mt-6 flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
          {tab("", "All", total)}
          {REFUND_STATUSES.map((s) =>
            tab(s, s.charAt(0).toUpperCase() + s.slice(1), counts[s] ?? 0)
          )}
        </div>

        {requests.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-slate-500">
            {total === 0
              ? "No one has requested a refund."
              : "Nothing in this status."}
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {requests.map((r) => (
              <li
                key={r.id}
                className={`rounded-2xl border p-5 ${
                  r.status === "open"
                    ? "border-amber-400/20 bg-amber-400/[0.04]"
                    : "border-white/[0.07] bg-white/[0.02]"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${
                          TONE[r.status] ?? TONE.open
                        }`}
                      >
                        {r.status}
                      </span>
                      <Link
                        href={`/admin/users/${r.userId}`}
                        className="truncate text-sm font-medium text-sky-300 underline-offset-2 hover:underline"
                      >
                        {r.currentEmail ?? r.snapshotEmail ?? r.userId}
                      </Link>
                      {/* The account may have changed since they asked. Both
                          are shown when they differ, because the decision is
                          about what they had at the time. */}
                      {r.snapshotPlan && (
                        <span className="text-[11px] text-slate-500">
                          was on {PLAN_LABELS[(r.snapshotPlan as Plan) ?? "free"] ?? r.snapshotPlan}
                          {r.currentPlan && r.currentPlan !== r.snapshotPlan && (
                            <span className="text-slate-600">
                              {" "}
                              · now {PLAN_LABELS[(r.currentPlan as Plan) ?? "free"] ?? r.currentPlan}
                            </span>
                          )}
                        </span>
                      )}
                      {!r.currentEmail && (
                        <span className="rounded bg-white/5 px-1.5 py-px text-[10px] text-slate-500">
                          account deleted
                        </span>
                      )}
                    </div>

                    {r.reason && (
                      <p className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-300">
                        {r.reason}
                      </p>
                    )}

                    <p className="mt-2.5 text-[11px] tabular-nums text-slate-500">
                      Asked {when.format(r.createdAt)} ET
                      {r.resolvedAt && ` · resolved ${when.format(r.resolvedAt)} ET`}
                      {r.stripeCustomerId && (
                        <>
                          {" · "}
                          <span className="font-mono text-slate-600">
                            {r.stripeCustomerId}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col items-stretch gap-2 sm:items-end">
                    {/* Once money has gone, the record of it replaces the
                        control — there is no second refund from here, and the
                        server refuses one even if this were bypassed. */}
                    {r.stripeRefundId ? (
                      <p className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-2 text-right text-[11px] leading-relaxed text-emerald-200">
                        Refunded{" "}
                        <span className="font-semibold tabular-nums">
                          {r.refundedAmountCents !== null
                            ? `$${(r.refundedAmountCents / 100).toFixed(2)}`
                            : ""}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-emerald-200/60">
                          {r.stripeRefundId}
                        </span>
                      </p>
                    ) : (
                      r.stripeCustomerId && <IssueRefund requestId={r.id} />
                    )}

                    <RefundActions id={r.id} status={r.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

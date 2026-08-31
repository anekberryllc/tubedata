import type { Metadata } from "next";
import Link from "next/link";
import { getAdminOverview, listUsers, requireAdminPage } from "@/lib/admin";
import { PLAN_LABELS } from "@/lib/plans";
import { ROLE_LABELS } from "@/lib/roles";
import { formatUsd } from "@/lib/pricing";
import { AdminUserControls } from "./AdminUserControls";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: "Admin",
  description: "Accounts and usage.",
  // Nothing here should ever reach an index, even by accident.
  robots: { index: false, follow: false },
};

// Reads the session and live counts, so it must never be cached.
export const dynamic = "force-dynamic";

/** Pinned to Eastern, like every other timestamp the product shows. */
const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

const num = (n: number) => n.toLocaleString("en-US");

function Tile({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "plain" | "warn";
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "warn" && value !== "0"
          ? "border-red-400/25 bg-red-400/[0.05]"
          : "border-white/[0.07] bg-white/[0.02]"
      }`}
    >
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

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "admin" | "pro" | "muted" | "blocked";
}) {
  const styles = {
    admin: "bg-amber-400/15 text-amber-200 ring-amber-400/30",
    pro: "bg-gradient-to-r from-sky-400/20 to-indigo-400/20 text-sky-200 ring-sky-400/30",
    blocked: "bg-red-400/15 text-red-200 ring-red-400/30",
    muted: "bg-white/5 text-slate-400 ring-white/10",
  }[tone];

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${styles}`}
    >
      {children}
    </span>
  );
}

export default async function AdminPage(props: PageProps<"/admin">) {
  // 404s for everyone else. Nothing below runs for a non-admin.
  const admin = await requireAdminPage();

  const { q } = await props.searchParams;
  const search = typeof q === "string" ? q : "";

  const [overview, people] = await Promise.all([getAdminOverview(), listUsers(search)]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 pb-24 pt-16">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">Admin</h1>
          <span className="text-sm text-slate-600">signed in as {admin.email}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Accounts, usage and moderation. Everything on this page is live.
        </p>

        <AdminNav current="overview" />

        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Accounts
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Users" value={num(overview.users)} />
            <Tile label="Pro" value={num(overview.pro)} hint="paying subscribers" />
            <Tile label="Admins" value={num(overview.admins)} />
            <Tile label="Blocked" value={num(overview.blocked)} tone="warn" />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Lookups
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Last 24h" value={num(overview.lookups24h)} />
            <Tile label="All time" value={num(overview.lookupsTotal)} />
            <Tile
              label="Signed in"
              value={num(overview.lookupsSignedIn)}
              hint={`${num(overview.lookupsTotal - overview.lookupsSignedIn)} anonymous`}
            />
            <Tile
              label="Videos cached"
              value={num(overview.videosCached)}
              hint="rows in videos"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* The daily YouTube quota is 10,000 units. The 24h figure is the
                one that decides whether the site can serve tomorrow. */}
            <Tile
              label="Quota 24h"
              value={num(overview.quota24h)}
              hint="of 10,000 units/day"
            />
            <Tile
              label="Quota all time"
              value={num(overview.quotaTotal)}
              hint={`${num(overview.lookupsTotal - overview.quotaTotal)} served from cache`}
            />
            <Tile
              label="Lookup packs"
              value={formatUsd(overview.purchaseCents)}
              hint={`${num(overview.purchases)} purchases`}
            />
            <Tile
              label="Tips"
              value={formatUsd(overview.donationCents)}
              hint={`${num(overview.donations)} donations`}
            />
          </div>
          {overview.openRefunds > 0 && (
            <Link
              href="/admin/refunds"
              className="mt-3 block rounded-xl border border-amber-400/25 bg-amber-400/[0.05] px-4 py-3 text-[13px] text-amber-200 transition hover:border-amber-400/40 hover:bg-amber-400/[0.09]"
            >
              {overview.openRefunds} open refund{" "}
              {overview.openRefunds === 1 ? "request" : "requests"} waiting on a
              decision — review {overview.openRefunds === 1 ? "it" : "them"} →
            </Link>
          )}
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Users
            </h2>
            {/* A plain GET form: the search term lives in the URL, so a filtered
                view can be linked, reloaded and bookmarked. */}
            <form className="flex items-center gap-2">
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Search name or email"
                className="w-56 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                Search
              </button>
              {search && (
                <Link
                  href="/admin"
                  className="text-[13px] text-slate-500 transition hover:text-slate-300"
                >
                  Clear
                </Link>
              )}
            </form>
          </div>

          {people.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center text-sm text-slate-500">
              No accounts match that search.
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {people.map((u) => {
                const label = u.email ?? u.name ?? u.id;
                return (
                  <li
                    key={u.id}
                    className={`rounded-2xl border p-4 ${
                      u.blockedAt
                        ? "border-red-400/20 bg-red-400/[0.04]"
                        : "border-white/[0.07] bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        {u.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={u.image}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-[13px] font-bold text-slate-950">
                            {label.trim().charAt(0).toUpperCase()}
                          </span>
                        )}

                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {/* The whole profile is one click away; the row
                                itself stays un-clickable so the block and role
                                buttons can't be hit by a stray navigation. */}
                            <Link
                              href={`/admin/users/${u.id}`}
                              className="truncate text-sm font-medium text-slate-200 underline-offset-4 transition hover:text-sky-300 hover:underline"
                            >
                              {u.name ?? u.email ?? "No name"}
                            </Link>
                            {u.id === admin.id && (
                              <span className="text-[10px] uppercase tracking-[0.1em] text-slate-600">
                                you
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {u.email ?? u.id}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge tone={u.role === "admin" ? "admin" : "muted"}>
                              {ROLE_LABELS[u.role]}
                            </Badge>
                            <Badge tone={u.plan === "pro" ? "pro" : "muted"}>
                              {PLAN_LABELS[u.plan]}
                            </Badge>
                            {u.blockedAt && <Badge tone="blocked">Blocked</Badge>}
                            {u.credits > 0 && (
                              <span className="text-[11px] tabular-nums text-sky-300">
                                {u.credits} prepaid
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-[11px] tabular-nums text-slate-500">
                            {num(u.lookups)} lookups
                            {u.lookups24h > 0 && ` · ${num(u.lookups24h)} in 24h`}
                            {u.lastLookupAt && ` · last ${when.format(u.lastLookupAt)} ET`}
                          </p>

                          {u.blockedAt && (
                            <p className="mt-2 rounded-lg border border-red-400/20 bg-black/20 px-3 py-2 text-[11px] leading-relaxed text-red-200">
                              Blocked {when.format(u.blockedAt)} ET
                              {u.blockedReason
                                ? ` — ${u.blockedReason}`
                                : " — no reason given"}
                            </p>
                          )}
                        </div>
                      </div>

                      <AdminUserControls
                        userId={u.id}
                        label={label}
                        role={u.role}
                        blocked={!!u.blockedAt}
                        isSelf={u.id === admin.id}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

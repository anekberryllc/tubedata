import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { searchLookups } from "@/lib/admin-lookups";
import { AdminNav } from "../AdminNav";
import { LookupTable } from "../LookupTable";

export const metadata: Metadata = {
  title: "All lookups",
  description: "Every request the site has served.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const num = (n: number) => n.toLocaleString("en-US");

export default async function AdminLookupsPage(props: PageProps<"/admin/lookups">) {
  await requireAdminPage();

  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const userId = typeof sp.user === "string" ? sp.user : undefined;
  const page = Number(typeof sp.page === "string" ? sp.page : "1") || 1;

  const result = await searchLookups({ q, userId, page });

  // Page links carry the current filters, so paging never silently drops the
  // search you are paging through.
  const href = (n: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (userId) params.set("user", userId);
    if (n > 1) params.set("page", String(n));
    const qs = params.toString();
    return qs ? `/admin/lookups?${qs}` : "/admin/lookups";
  };

  const from = (result.page - 1) * result.perPage + 1;
  const to = Math.min(result.page * result.perPage, result.total);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">All lookups</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Every request the site has served, newest first — signed in and anonymous.
          Search matches video id, URL, title, channel, account email or IP address.
        </p>

        <AdminNav current="lookups" />

        <form className="mt-6 flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search lookups…"
            className="w-72 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none"
          />
          {/* Carried through the form so searching inside a user's lookups
              doesn't quietly widen back out to the whole site. */}
          {userId && <input type="hidden" name="user" value={userId} />}
          <button
            type="submit"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            Search
          </button>
          {(q || userId) && (
            <Link
              href="/admin/lookups"
              className="text-[13px] text-slate-500 transition hover:text-slate-300"
            >
              Clear filters
            </Link>
          )}
        </form>

        {userId && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-400/[0.06] px-3 py-1.5 text-[12px] text-sky-200">
            Filtered to one account
            <Link
              href={`/admin/users/${userId}`}
              className="underline underline-offset-2 hover:text-sky-100"
            >
              open their profile
            </Link>
          </p>
        )}

        <p className="mb-3 mt-5 text-xs text-slate-500">
          {result.total === 0
            ? "No matching lookups."
            : `${num(result.total)} ${result.total === 1 ? "lookup" : "lookups"} · showing ${num(from)}–${num(to)}`}
        </p>

        <LookupTable rows={result.rows} />

        {result.pages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            {result.page > 1 ? (
              <Link
                href={href(result.page - 1)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                ← Newer
              </Link>
            ) : (
              <span />
            )}

            <span className="text-[12px] tabular-nums text-slate-500">
              Page {num(result.page)} of {num(result.pages)}
            </span>

            {result.page < result.pages ? (
              <Link
                href={href(result.page + 1)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                Older →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </main>
  );
}

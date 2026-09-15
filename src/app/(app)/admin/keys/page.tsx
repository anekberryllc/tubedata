import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin";
import { listApiKeys, DEFAULT_DAILY_QUOTA, pacificDay } from "@/lib/api-keys";
import { AdminNav } from "../AdminNav";
import { AddApiKey, ApiKeyRow } from "./ApiKeyControls";

export const metadata: Metadata = {
  title: "API keys",
  description: "YouTube Data API key pool.",
};

export const dynamic = "force-dynamic";

/**
 * The YouTube API key pool.
 *
 * Guarded by requireAdminPage, which answers 404 rather than 403 — a stranger
 * poking at this URL learns only that there is nothing there, and this is the
 * one screen in the panel where that matters most.
 *
 * Keys are read through listApiKeys(), which returns them MASKED. The full
 * values never reach this component, let alone the browser.
 */
export default async function ApiKeysPage() {
  await requireAdminPage();

  const keys = await listApiKeys();

  const inRotation = keys.filter((k) => k.active && !k.exhausted && !k.invalidAt);
  const spentToday = keys.reduce((sum, k) => sum + k.unitsToday, 0);
  const envFallback = keys.length === 0 && !!process.env.YOUTUBE_API_KEY;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 pb-24 pt-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100">Admin</h1>
        <AdminNav current="keys" />

        <div className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">YouTube API keys</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
                Keys are tried top to bottom. When Google says a key&rsquo;s daily quota is
                gone, it drops out of rotation and the next one takes over — automatically,
                and back again after the reset at midnight Pacific.
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-slate-100">{inRotation.length}</span> of{" "}
                {keys.length} in rotation
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                ~{spentToday.toLocaleString("en-US")} units spent today ·{" "}
                {pacificDay()} Pacific
              </p>
            </div>
          </div>

          {/* The estimate caveat is stated once, here, rather than beside every
              number: our count only sees calls this app made. */}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
            Unit counts are this site&rsquo;s own tally, not Google&rsquo;s — anything else
            using the same key spends quota we cannot see. Google grants{" "}
            {DEFAULT_DAILY_QUOTA.toLocaleString("en-US")} units per project per day by
            default, and exposes no way to query what is left.
          </p>

          {envFallback && (
            <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-400/[0.05] px-5 py-4">
              <p className="text-sm font-medium text-sky-100">
                Currently running on the <code>YOUTUBE_API_KEY</code> environment variable.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-sky-200/70">
                The pool is empty, so that variable is still what serves lookups. Add it
                below and it becomes manageable from here — and once any key exists in
                this list, the environment variable is ignored.
              </p>
            </div>
          )}

          {keys.length > 0 && inRotation.length === 0 && (
            <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/[0.06] px-5 py-4">
              <p className="text-sm font-medium text-red-100">
                No key is in rotation — lookups are failing right now.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-red-200/70">
                Every key is off, spent, or rejected. Quota-spent keys return by
                themselves after midnight Pacific; anything else needs a new key or a
                fix in Google Cloud Console.
              </p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {keys.map((k, i) => (
              <ApiKeyRow
                key={k.id}
                apiKey={k}
                first={i === 0}
                last={i === keys.length - 1}
              />
            ))}

            {keys.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-slate-600">
                No keys in the pool yet.
              </p>
            )}
          </div>

          <div className="mt-6">
            <AddApiKey />
          </div>
        </div>
      </div>
    </main>
  );
}

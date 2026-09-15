"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { VideoMetadata } from "@/lib/youtube";
import type { Plan } from "@/lib/plans";
import type { EarningsEstimate } from "@/lib/earnings";
import { publishCredits } from "@/components/credits-channel";
import {
  formatUsd,
  PRO_PRICE_CENTS,
  ANNUAL_SAVING_PERCENT,
  ANNUAL_MONTHLY_EQUIVALENT_CENTS,
  TAX_NOTE,
} from "@/lib/pricing";
import {
  PRO_ALLOWANCE_LABEL,
  formatLookups,
  type LimitPeriod,
} from "@/lib/limits";
import { SectionHeading } from "@/components/InfoHint";
import { CopyButton } from "@/components/CopyButton";
import { UpgradeButton } from "@/components/UpgradeButton";
import { BuyLookups } from "@/components/BuyLookups";

type StatPoint = {
  capturedAt: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
};

type Result = Partial<VideoMetadata> & { tagCount: number };

type RateLimit = {
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  /** "day" for the free IP allowance, "month" for a Pro account's. */
  period: LimitPeriod | null;
};

const n = (x?: number | null) => (x === null || x === undefined ? "—" : x.toLocaleString());

/** Cents only matter at the low end, where a Short can earn less than a dollar. */
const usd = (x: number) =>
  x >= 10 ? `$${Math.round(x).toLocaleString()}` : `$${x.toFixed(2)}`;

/** 1,807,661,715 -> 1.8B, for the big stat tiles. */
function compact(x?: number | null) {
  if (x === null || x === undefined) return "—";
  if (x >= 1e9) return (x / 1e9).toFixed(x >= 1e10 ? 0 : 1) + "B";
  if (x >= 1e6) return (x / 1e6).toFixed(x >= 1e7 ? 0 : 1) + "M";
  if (x >= 1e3) return (x / 1e3).toFixed(x >= 1e4 ? 0 : 1) + "K";
  return String(x);
}

/** Every reset time is quoted in Eastern, so the label is never ambiguous. */
const RESET_TZ = "America/New_York";

/**
 * Date and time at which the next free lookup unlocks — "Aug 27 at 1:29 PM ET".
 *
 * The allowance is a ROLLING 24h window, not a midnight reset: a slot frees
 * 24h after the lookup that used it. So this is the moment ONE lookup comes
 * back — the oldest ageing out — and the copy must promise no more than that.
 * Someone who spread their ten across yesterday gets them back in a trickle.
 *
 * Pinned to Eastern and to en-US rather than the visitor's own locale, so the
 * output is one fixed string worldwide. That also makes it deterministic
 * between server and client — nothing here reads the browser's timezone.
 */
function resetLabel(at: Date) {
  const date = at.toLocaleDateString("en-US", { timeZone: RESET_TZ, month: "short", day: "numeric" });
  const time = at.toLocaleTimeString("en-US", { timeZone: RESET_TZ, hour: "numeric", minute: "2-digit" });

  return `${date} at ${time} ET`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<Result | null>(null);
  const [history, setHistory] = useState<StatPoint[]>([]);
  const [plan, setPlan] = useState<Plan>("free");
  const [meta, setMeta] = useState<{ cacheHit: boolean; quotaUnits: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The 429 gets its own treatment: it is the one error with a fix to sell.
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Included on every lookup now, for everyone — null only before the first
  // one, or when the video gives the model nothing to work from.
  const [earnings, setEarnings] = useState<EarningsEstimate | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  // Stored as an absolute instant, not a countdown, so it stays truthful in a
  // tab left open for an hour.
  const [resetAt, setResetAt] = useState<Date | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const didInit = useRef(false);
  /**
   * The dev-only ?plan= preview, captured on mount because the init effect
   * strips the query string before the first lookup runs.
   *
   * Forwarding it is a convenience for previewing the paid view, NOT a
   * permission: resolvePlan ignores the parameter outside development, so the
   * server remains the only thing deciding what a caller may see.
   */
  const previewPlan = useRef<string | null>(null);
  const [upgraded, setUpgraded] = useState(false);
  const [donated, setDonated] = useState(false);
  const [purchased, setPurchased] = useState<number | null>(null);

  const runLookup = useCallback(async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    setLoading(true);
    setError(null);
    setErrorReason(null);
    setResetAt(null);
    setEarnings(null);
    setData(null);
    setHistory([]);
    setMeta(null);

    // Survive the round trip to Stripe, which reloads the page and would
    // otherwise drop the result the user was looking at.
    sessionStorage.setItem("lastLookup", targetUrl);

    const qs = new URLSearchParams({ url: targetUrl });
    if (previewPlan.current) qs.set("plan", previewPlan.current);
    const res = await fetch(`/api/video?${qs}`);
    const json = await res.json();

    setLoading(false);
    if (json.ok) {
      setData(json.data);
      setHistory(json.statsHistory ?? []);
      setEarnings(json.earnings ?? null);
      setPlan(json.plan);
      setMeta({ cacheHit: json.cacheHit, quotaUnits: json.quotaUnits });
      setRateLimit(json.rateLimit ?? null);
      setCredits(json.credits ?? null);
      publishCredits(json.credits ?? null);
    } else {
      setError(json.message ?? "Something went wrong.");
      setErrorReason(json.reason ?? null);
      // A 429 carries the allowance too, so the counter stays truthful.
      if (json.rateLimit) setRateLimit(json.rateLimit);
      // Converted to an instant on arrival, while the elapsed time is still 0.
      if (typeof json.retryAfterSeconds === "number") {
        setResetAt(new Date(Date.now() + json.retryAfterSeconds * 1000));
      }
      if (json.credits !== undefined) {
        setCredits(json.credits);
        publishCredits(json.credits);
      }
    }
  }, []);

  // On return from Stripe: confirm the upgrade and restore what they were viewing.
  useEffect(() => {
    // StrictMode double-invokes effects in development, and this one spends a
    // lookup from the daily allowance. Without the guard a ?v= deep link costs
    // two of the user's ten.
    if (didInit.current) return;
    didInit.current = true;

    const params = new URLSearchParams(window.location.search);
    // Read before the replaceState below wipes it.
    previewPlan.current = params.get("plan");
    const justUpgraded = params.get("upgraded") === "1";
    const justDonated = params.get("donated") === "1";
    const boughtCredits = Number(params.get("credits") ?? 0);

    if (justUpgraded) setUpgraded(true);
    if (justDonated) setDonated(true);
    if (boughtCredits > 0) setPurchased(boughtCredits);

    // Arriving from the history page: ?v=<videoId> re-runs that lookup.
    const fromHistory = params.get("v");

    if (justUpgraded || justDonated || boughtCredits > 0 || fromHistory) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (fromHistory) {
      const target = `https://youtu.be/${fromHistory}`;
      setUrl(target);
      void runLookup(target);
      return;
    }

    // Stripe reloads the page, so restore whatever they were looking at —
    // a tip should not cost the user their result either.
    const last = sessionStorage.getItem("lastLookup");
    if (last) {
      setUrl(last);
      // Re-run after any Stripe round trip: coming back to an empty page reads
      // as a failed payment even when it succeeded.
      if (justUpgraded || justDonated || boughtCredits > 0) void runLookup(last);
    }
  }, [runLookup]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    await runLookup(url);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        {/* ================= HERO ================= */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Free — no account needed
          </span>

          <h1 className="mt-6 text-balance bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-5xl font-bold leading-[1.1] tracking-tight text-transparent sm:text-6xl">
            Every detail behind
            <br />
            any YouTube video
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-slate-400">
            Paste a link and see the full public record — including tags, topic
            categories, and thumbnail sets that never appear on the watch page.
          </p>
        </div>

        {/* ================= SEARCH ================= */}
        <form onSubmit={lookup} className="mt-10">
          <div className="group relative rounded-2xl bg-gradient-to-r from-sky-500/25 via-indigo-500/25 to-fuchsia-500/25 p-px transition focus-within:from-sky-400/60 focus-within:via-indigo-400/60 focus-within:to-fuchsia-400/60">
            <div className="flex items-center gap-2 rounded-2xl bg-[#0a0e18] p-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtu.be/dQw4w9WgXcQ"
                className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-40"
              >
                {loading ? "Fetching…" : "Analyze"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-xs text-slate-600">
              Works with watch links, youtu.be, Shorts, and embeds.
            </p>
            {rateLimit && (
              <p className="text-xs text-slate-600">
                {rateLimit.unlimited ? (
                  <span className="text-amber-300/80">Unlimited lookups</span>
                ) : (
                  <>
                    <span
                      className={
                        (rateLimit.remaining ?? 0) === 0 ? "text-red-300" : "text-slate-400"
                      }
                    >
                      {formatLookups(rateLimit.remaining ?? 0)}
                    </span>{" "}
                    of {formatLookups(rateLimit.limit ?? 0)}{" "}
                    {rateLimit.period === "month"
                      ? "lookups left this month"
                      : "free lookups left today"}
                    {credits !== null && credits > 0 && (
                      <span className="text-sky-300/70"> · {credits} prepaid</span>
                    )}
                  </>
                )}
              </p>
            )}
          </div>
        </form>

        {upgraded && (
          <div className="animate-rise mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-5 py-4 text-sm text-emerald-200">
            <strong className="font-semibold">Upgrade complete.</strong>{" "}
            {PRO_ALLOWANCE_LABEL} and your full lookup history are now unlocked —
            restoring your last lookup below.
          </div>
        )}

        {purchased !== null && (
          <div className="animate-rise mt-6 rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] px-5 py-4 text-sm text-sky-200">
            <strong className="font-semibold">{purchased} lookups added.</strong> They never
            expire, and they are only spent once your included allowance runs out.
          </div>
        )}

        {donated && (
          <div className="animate-rise mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-5 py-4 text-sm text-amber-200">
            <strong className="font-semibold">Thank you.</strong> That genuinely helps
            keep the free tier free.
          </div>
        )}

        {error && errorReason === "rate_limited" && (
          <div className="animate-rise mt-6 rounded-2xl border border-amber-400/25 bg-gradient-to-b from-amber-400/[0.08] to-transparent px-5 py-4">
            {rateLimit?.period === "month" ? (
              /* A SUBSCRIBER who has run out. There is no upgrade to sell them
                 — they already bought the thing — so this says when the
                 allowance comes back and offers the only thing that helps
                 today. Pitching Pro at someone who pays for Pro reads as the
                 site not knowing who they are. */
              <>
                <p className="text-sm font-medium text-amber-100">
                  You have used all {formatLookups(rateLimit.limit ?? 0)} lookups
                  included with Pro this month.
                </p>
                <p className="mt-1 text-sm text-amber-200/70">
                  {resetAt ? (
                    <>
                      Your allowance resets{" "}
                      <span className="font-medium text-amber-100">{resetLabel(resetAt)}</span>.
                    </>
                  ) : (
                    <>Your allowance resets at the start of next month.</>
                  )}
                </p>

                <div className="mt-4 border-t border-amber-400/15 pt-4">
                  <p className="mb-2.5 text-xs text-amber-200/60">
                    Need more before then? Prepaid lookups never expire.
                  </p>
                  <BuyLookups />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="min-w-[16rem] flex-1">
                    <p className="text-sm font-medium text-amber-100">
                      You have used all {rateLimit?.limit ?? 10} free lookups for today.
                    </p>
                    <p className="mt-1 text-sm text-amber-200/70">
                      {resetAt ? (
                        <>
                          Your next free lookup unlocks{" "}
                          <span className="font-medium text-amber-100">
                            {resetLabel(resetAt)}
                          </span>
                          . Pro gives you {PRO_ALLOWANCE_LABEL} and your full lookup
                          history.
                        </>
                      ) : (
                        <>
                          Pro gives you {PRO_ALLOWANCE_LABEL} and your full lookup
                          history — or come back tomorrow.
                        </>
                      )}
                    </p>
                  </div>
                  {/* Yearly leads because it is the better deal; monthly stays one
                      click away rather than being buried. */}
                  <div className="flex shrink-0 flex-col items-stretch gap-1.5">
                    <UpgradeButton
                      interval="year"
                      label={`Get Pro — ${formatUsd(PRO_PRICE_CENTS.year)}/yr`}
                      className="rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/10 transition hover:brightness-110 disabled:opacity-50"
                    />
                    <p className="text-center text-[11px] text-amber-200/60">
                      Save {ANNUAL_SAVING_PERCENT}% —{" "}
                      {formatUsd(ANNUAL_MONTHLY_EQUIVALENT_CENTS)}/mo billed yearly
                      <br />
                      <span className="text-amber-200/45">{TAX_NOTE}</span>
                    </p>
                    <UpgradeButton
                      interval="month"
                      label={`or ${formatUsd(PRO_PRICE_CENTS.month)}/mo`}
                      className="rounded-xl border border-amber-400/25 px-4 py-1.5 text-xs font-medium text-amber-200/80 transition hover:border-amber-400/50 hover:text-amber-100 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="mt-4 border-t border-amber-400/15 pt-4">
                  <p className="mb-2.5 text-xs text-amber-200/60">
                    Or buy lookups once — no subscription, and they never expire.
                  </p>
                  <BuyLookups />
                </div>
              </>
            )}
          </div>
        )}

        {error && errorReason !== "rate_limited" && (
          <div className="animate-rise mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading && (
          <div className="mt-8 animate-pulse space-y-4 rounded-3xl border border-white/[0.07] bg-white/[0.02] p-6">
            <div className="h-44 rounded-2xl bg-white/[0.04]" />
            <div className="h-5 w-3/4 rounded bg-white/[0.04]" />
            <div className="h-4 w-1/3 rounded bg-white/[0.04]" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-white/[0.04]" />
              ))}
            </div>
          </div>
        )}

        {/* ================= RESULT ================= */}
        {data && (
          <div className="animate-rise mt-8 overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.02] shadow-2xl shadow-black/40">
            {/* Hero image + title overlay */}
            {data.thumbnail && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.thumbnail} alt="" className="w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e18] via-[#0a0e18]/40 to-transparent" />
                {data.duration && (
                  <span className="absolute right-3 top-3 rounded-md bg-black/70 px-2 py-1 text-xs font-medium tabular-nums text-white backdrop-blur">
                    {data.duration}
                  </span>
                )}
              </div>
            )}

            <div className="space-y-8 p-6 sm:p-7">
              {/* ---------- OVERVIEW ---------- */}
              <div className={data.thumbnail ? "-mt-16 relative" : ""}>
                <SectionHeading field="overview">Overview</SectionHeading>
                <h2 className="text-pretty text-xl font-semibold leading-snug text-white">
                  {data.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                  <span className="font-medium text-slate-300">{data.channelTitle}</span>
                  <span className="text-slate-700">·</span>
                  <span>
                    {data.publishedAt
                      ? new Date(data.publishedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </span>
                  <span className="text-slate-700">·</span>
                  <span className="tabular-nums">{data.duration}</span>
                  {data.definition && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400 ring-1 ring-white/10">
                      {data.definition}
                    </span>
                  )}
                </div>
              </div>

              {/* ---------- ENGAGEMENT ---------- */}
              <div>
                <SectionHeading field="engagement">Engagement</SectionHeading>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      ["Views", data.viewCount],
                      ["Likes", data.likeCount],
                      ["Comments", data.commentCount],
                    ] as const
                  ).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-white/[0.12]"
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {label}
                      </div>
                      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-white">
                        {compact(value)}
                      </div>
                      <div className="mt-0.5 text-[11px] tabular-nums text-slate-600">
                        {n(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ---------- ESTIMATED EARNINGS ---------- */}
              <div>
                <SectionHeading field="earnings">Estimated earnings</SectionHeading>

                {earnings && (
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Lifetime range
                        </div>
                        <div className="mt-1.5 text-2xl font-semibold tabular-nums text-white">
                          {/* A low-view Short rounds to $0.00 at both ends, which
                              reads as a bug rather than as a small number. */}
                          {earnings.high < 0.01
                            ? "Under $0.01"
                            : `${usd(earnings.low)} – ${usd(earnings.high)}`}
                        </div>
                        <div className="mt-0.5 text-[11px] tabular-nums text-slate-600">
                          {n(earnings.views)} views ÷ 1,000 × RPM
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Assumed RPM
                        </div>
                        <div className="mt-1.5 text-2xl font-semibold tabular-nums text-white">
                          ${earnings.rpmLow} – ${earnings.rpmHigh}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-600">
                          {earnings.category}
                          {earnings.format === "short" && " · Short"}
                        </div>
                      </div>
                    </div>

                    {earnings.adjustments.length > 0 && (
                      <ul className="mt-4 space-y-1 border-t border-white/[0.06] pt-3">
                        {earnings.adjustments.map((a) => (
                          <li key={a} className="text-[11px] text-slate-500">
                            · {a}
                          </li>
                        ))}
                      </ul>
                    )}

                    <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-slate-600">
                      TubeData estimate, not a YouTube figure. Assumes the channel is
                      monetised, and counts ad revenue only — sponsorships, memberships and
                      merch are invisible from public data.
                    </p>
                  </div>
                )}
              </div>

              {/* ---------- TAGS ---------- */}
              <div>
                <SectionHeading
                  field="tags"
                  count={data.tagCount}
                  action={
                    (data.tags?.length ?? 0) > 0 && (
                      <CopyButton
                        text={() => (data.tags ?? []).join(", ")}
                        label="Copy tags"
                        title="Copy as a comma-separated list, ready to paste into YouTube Studio"
                      />
                    )
                  }
                >
                  Tags
                </SectionHeading>

                {data.tagCount === 0 ? (
                  <p className="text-sm text-slate-600">
                    This video has no tags — the uploader left them blank.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {(data.tags ?? []).map((t) => (
                      <span
                        key={t}
                        className="rounded-lg bg-sky-400/[0.08] px-2.5 py-1 text-xs text-sky-200 ring-1 ring-sky-400/15"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ---------- THUMBNAILS ---------- */}
              {Object.keys(data.thumbnails ?? {}).length > 0 && (
                <div>
                  <SectionHeading
                    field="thumbnails"
                    count={`${Object.keys(data.thumbnails!).length} sizes`}
                  >
                    Thumbnails
                  </SectionHeading>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(data.thumbnails!).map(([size, t]) => (
                      <a
                        key={size}
                        href={t.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-xs transition hover:border-sky-400/30 hover:bg-sky-400/[0.05]"
                      >
                        <span className="font-medium text-slate-300 group-hover:text-sky-200">
                          {size}
                        </span>
                        {t.width && t.height && (
                          <span className="tabular-nums text-slate-600">
                            {t.width}×{t.height}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------- TOPICS ---------- */}
              {(data.topics?.length ?? 0) > 0 && (
                <div>
                  <SectionHeading field="topics">Topic categories</SectionHeading>
                  <div className="flex flex-wrap gap-1.5">
                    {data.topics!.map((t) => (
                      <span
                        key={t}
                        className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/10"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------- HISTORY ---------- */}
              <div>
                <SectionHeading
                  field="history"
                  count={`${history.length} snapshot${history.length === 1 ? "" : "s"}`}
                >
                  Statistics history
                </SectionHeading>

                  {history.length < 2 ? (
                    <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm leading-relaxed text-slate-400">
                      Only {history.length} snapshot so far. Look this video up again tomorrow and a
                      growth curve begins here — figures YouTube cannot provide retroactively.
                    </p>
                  ) : (
                    <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                      {history.map((p) => (
                        <div
                          key={p.capturedAt}
                          className="flex items-center justify-between px-4 py-2.5 text-sm"
                        >
                          <span className="text-slate-500">
                            {new Date(p.capturedAt).toLocaleString()}
                          </span>
                          <span className="tabular-nums text-slate-200">
                            {n(p.viewCount)} views
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              {/* ---------- TECHNICAL ---------- */}
              <div>
                <SectionHeading field="technical">Technical details</SectionHeading>
                <dl className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
                  {(
                    [
                      ["Captions", data.hasCaptions ? "Available" : "None"],
                      ["Audio language", data.language ?? "Not set"],
                      ["Privacy", data.privacyStatus ?? "—"],
                      ["Made for kids", data.madeForKids ? "Yes" : "No"],
                      ["Embeddable", data.embeddable ? "Yes" : "No"],
                      ["Licensed content", data.licensedContent ? "Yes" : "No"],
                    ] as const
                  ).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-4 border-b border-white/[0.05] py-2.5 text-sm"
                    >
                      <dt className="text-slate-500">{k}</dt>
                      <dd className="text-slate-200">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* ---------- DESCRIPTION ---------- */}
              <div>
                <SectionHeading
                  field="description"
                  count={`${data.description?.length ?? 0} chars`}
                  action={
                    !!data.description && (
                      <CopyButton
                        text={() => data.description ?? ""}
                        label="Copy description"
                        title="Copy the full description, including the part hidden behind “…more” on YouTube"
                      />
                    )
                  }
                >
                  Description
                </SectionHeading>
                <details className="group">
                  <summary className="cursor-pointer list-none rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-sm text-slate-400 transition hover:text-slate-200">
                    <span className="group-open:hidden">Show full description</span>
                    <span className="hidden group-open:inline">Hide description</span>
                  </summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.07] bg-black/30 p-4 font-sans text-[13px] leading-relaxed text-slate-400">
                    {data.description || "(empty)"}
                  </pre>
                </details>
              </div>

              {/* ---------- RAW ---------- */}
              <div>
                <SectionHeading field="raw">Raw API response</SectionHeading>
                <details className="group">
                  <summary className="cursor-pointer list-none rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-sm text-slate-400 transition hover:text-slate-200">
                    <span className="group-open:hidden">Show JSON</span>
                    <span className="hidden group-open:inline">Hide JSON</span>
                  </summary>
                  <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-white/[0.07] bg-black/30 p-4 font-mono text-[11px] leading-relaxed text-slate-500">
                    {JSON.stringify(data.raw, null, 2)}
                  </pre>
                </details>
              </div>

              {/* ---------- FOOTER ---------- */}
              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-5 text-[11px]">
                <span
                  className={`rounded-md px-2 py-1 font-medium ${
                    meta?.cacheHit
                      ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20"
                      : "bg-sky-400/10 text-sky-300 ring-1 ring-sky-400/20"
                  }`}
                >
                  {meta?.cacheHit ? "Served from cache" : "Fetched from YouTube"}
                </span>
                <span className="text-slate-600">
                  {meta?.quotaUnits ?? 0} quota unit{meta?.quotaUnits === 1 ? "" : "s"} used
                </span>
                <span className="ml-auto text-slate-700">{plan} plan</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

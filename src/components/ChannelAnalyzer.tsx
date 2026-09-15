"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";
import { WEEKDAYS, type ChannelStats } from "@/lib/channel-stats";
import { RECENT_VIDEOS, type ChannelData } from "@/lib/youtube-channel";
import type { ChannelAudit, CheckStatus } from "@/lib/channel-audit";
import { formatDuration } from "@/lib/youtube";

/**
 * Channel analyzer.
 *
 * TWO KINDS OF NUMBER, KEPT VISUALLY APART, because conflating them is how
 * these tools mislead:
 *
 *   REPORTED — subscribers, total views, video count. Straight from YouTube,
 *              about the channel's whole life.
 *   RECENT   — everything derived from the last {RECENT_VIDEOS} uploads. About
 *              what the channel does NOW, which is what anyone sizing up a
 *              competitor actually wants.
 *
 * A channel's all-time average views is a fact about 2016. The recent sample is
 * the useful half, and the headings say which is which.
 */

type Result = {
  data: ChannelData;
  stats: ChannelStats;
  audit: ChannelAudit;
  quotaUnits: number;
};

/**
 * Verdict styling. The symbol carries the meaning as well as the colour —
 * roughly one man in twelve cannot reliably separate the red from the green,
 * and a checklist that only speaks in colour says nothing to them.
 */
const STATUS: Record<CheckStatus, { mark: string; ring: string; text: string }> = {
  good: { mark: "✓", ring: "ring-emerald-400/25 bg-emerald-400/[0.07]", text: "text-emerald-300" },
  warn: { mark: "!", ring: "ring-amber-400/25 bg-amber-400/[0.07]", text: "text-amber-300" },
  bad: { mark: "✕", ring: "ring-red-400/25 bg-red-400/[0.07]", text: "text-red-300" },
  info: { mark: "·", ring: "ring-white/10 bg-white/[0.03]", text: "text-slate-400" },
};

function AuditSection({ section }: { section: ChannelAudit["sections"][number] }) {
  return (
    <div className="mt-6">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {section.title}
      </h3>
      <div className="mt-3 space-y-2">
        {section.checks.map((c) => {
          const st = STATUS[c.status];
          return (
            <div
              key={c.id}
              className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ring-1 ${st.ring} ${st.text}`}
              >
                {st.mark}
              </span>
              <div className="min-w-[10rem] flex-1">
                <p className="text-sm font-medium text-slate-200">
                  {c.label}
                  {/* Said per row, not once in a footnote, because a reader
                      scanning verdicts will not go looking for the caveat. */}
                  {c.sampled && (
                    <span className="ml-2 text-[10px] font-normal text-slate-600">
                      recent uploads only
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{c.message}</p>
              </div>
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${st.text}`}>
                {c.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const nf = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const pct = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`;

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="text-[11px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-slate-600">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-3 mt-10 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-medium text-slate-200">{children}</h2>
      {note && <p className="text-[11px] text-slate-600">{note}</p>}
    </div>
  );
}

export function ChannelAnalyzer() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel?q=${encodeURIComponent(q)}`);
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not analyze that channel.");
        setResult(null);
        return;
      }
      setResult(json);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const d = result?.data;
  const s = result?.stats;

  return (
    <>
      <form onSubmit={analyze} className="mt-10">
        <div className="group relative rounded-2xl bg-gradient-to-r from-sky-500/25 via-indigo-500/25 to-fuchsia-500/25 p-px transition focus-within:from-sky-400/60 focus-within:via-indigo-400/60 focus-within:to-fuchsia-400/60">
          <div className="flex items-center gap-2 rounded-2xl bg-[#0a0e18] p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="youtube.com/@mkbhd"
              aria-label="Channel URL or handle"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-40"
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </div>
        <p className="mt-3 px-1 text-xs text-slate-600">
          A channel URL or @handle. Old <code>/c/</code> vanity URLs can&rsquo;t be
          resolved cheaply — copy the @handle from the channel header instead.
        </p>
      </form>

      {error && (
        <div className="animate-rise mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {d && s && (
        <div className="animate-rise mt-8">
          {/* ---------- IDENTITY ---------- */}
          <div className="flex flex-wrap items-start gap-4 rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5">
            {d.thumbnails?.medium?.url && (
              // Avatars come from yt3.ggpht.com, a host that changes; adding a
              // remote-pattern entry to next.config for one 56px image is not
              // worth it, and next/image would proxy it through our server for
              // no benefit. The directive has to sit on the line directly above
              // the element — with a comment in between it lands on the comment.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.thumbnails.medium.url}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-full"
              />
            )}
            <div className="min-w-[12rem] flex-1">
              <h2 className="text-lg font-semibold text-slate-100">{d.title}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {d.customUrl ?? d.channelId}
                {d.country && <> · {d.country}</>}
                {d.publishedAt && (
                  <> · since {new Date(d.publishedAt).getFullYear()}</>
                )}
                {d.madeForKids && <> · made for kids</>}
              </p>
              {d.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {d.description}
                </p>
              )}
            </div>
          </div>

          {/* ---------- REPORTED BY YOUTUBE ---------- */}
          <SectionTitle note="straight from YouTube, all-time">
            Channel totals
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Subscribers"
              value={
                d.subscribersHidden
                  ? "Hidden"
                  : d.subscriberCount !== null
                    ? compact.format(d.subscriberCount)
                    : "—"
              }
              // Not a rounding error on our side — worth saying, because people
              // compare this against a number they saw elsewhere.
              hint={
                d.subscribersHidden
                  ? "This channel hides its count"
                  : "YouTube rounds this publicly"
              }
            />
            <Stat
              label="Total views"
              value={d.viewCount !== null ? compact.format(d.viewCount) : "—"}
              hint={d.viewCount !== null ? nf.format(d.viewCount) : undefined}
            />
            <Stat
              label="Videos"
              value={d.videoCount !== null ? nf.format(d.videoCount) : "—"}
              hint="Public uploads"
            />
          </div>

          {/* ---------- RECENT PERFORMANCE ---------- */}
          {s.sampleSize > 0 ? (
            <>
              <SectionTitle note={`from the last ${s.sampleSize} uploads`}>
                How it performs now
              </SectionTitle>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat
                  label="Median views"
                  value={s.medianViews !== null ? compact.format(s.medianViews) : "—"}
                  // The gap between these two is the interesting part: a mean far
                  // above the median means one video carried the channel.
                  hint={
                    s.meanViews !== null
                      ? `Mean ${compact.format(s.meanViews)} — a much higher mean means one video carried it`
                      : undefined
                  }
                />
                <Stat
                  label="Uploads / week"
                  value={s.uploadsPerWeek !== null ? s.uploadsPerWeek.toFixed(1) : "—"}
                  hint={
                    s.daysSinceLastUpload !== null
                      ? `Last upload ${s.daysSinceLastUpload} day${s.daysSinceLastUpload === 1 ? "" : "s"} ago`
                      : undefined
                  }
                />
                <Stat
                  label="Typical length"
                  value={
                    s.medianDurationSeconds !== null
                      ? formatDuration(s.medianDurationSeconds)
                      : "—"
                  }
                  hint={
                    s.shortsShare !== null
                      ? `${pct(s.shortsShare)} Shorts · ${pct(s.midRollShare ?? 0)} over 8 min`
                      : undefined
                  }
                />
                <Stat
                  label="Like rate"
                  value={s.likeRate !== null ? pct(s.likeRate) : "—"}
                  hint="Likes ÷ views across the sample"
                />
                <Stat
                  label="Comment rate"
                  value={s.commentRate !== null ? pct(s.commentRate) : "—"}
                  hint="Comments ÷ views across the sample"
                />
                <Stat
                  label="Usual upload day"
                  value={s.busiestWeekday !== null ? WEEKDAYS[s.busiestWeekday] : "No pattern"}
                  hint={
                    s.busiestWeekday !== null
                      ? "Most common day in the sample"
                      : "No single day leads"
                  }
                />
              </div>

              {/* ---------- BEST / WORST ---------- */}
              {s.bestVideo && s.worstVideo && s.bestVideo.videoId !== s.worstVideo.videoId && (
                <>
                  <SectionTitle note="within the sample">Spread</SectionTitle>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { v: s.bestVideo, label: "Best performing", tone: "text-emerald-300" },
                      { v: s.worstVideo, label: "Weakest", tone: "text-slate-400" },
                    ].map(({ v, label, tone }) => (
                      <div
                        key={v.videoId}
                        className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
                      >
                        <p className="text-[11px] uppercase tracking-wider text-slate-600">
                          {label}
                        </p>
                        <p className={`mt-1.5 text-sm font-semibold tabular-nums ${tone}`}>
                          {v.viewCount !== null ? nf.format(v.viewCount) : "—"} views
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                          {v.title}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-white/10 px-5 py-6 text-center text-sm text-slate-600">
              No public uploads to analyze.
            </p>
          )}

          {/* ---------- AUDIT ---------- */}
          <SectionTitle
            note={`${result.audit.passed} of ${result.audit.gradeable} checks clear`}
          >
            Assessment
          </SectionTitle>
          {result.audit.sections.map((sec) => (
            <AuditSection key={sec.title} section={sec} />
          ))}

          {result.audit.recommendations.length > 0 ? (
            <>
              <SectionTitle note="in the order worth doing them">
                Recommendations
              </SectionTitle>
              <ol className="space-y-2">
                {result.audit.recommendations.map((r, i) => (
                  <li
                    key={r.id}
                    className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                  >
                    <span className="mt-0.5 text-xs font-semibold tabular-nums text-slate-600">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{r.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{r.detail}</p>
                      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-slate-600">
                        from: {r.from}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] px-5 py-4 text-sm text-emerald-200">
              Nothing to flag — every check this tool makes came back clear.
            </p>
          )}

          {/* ---------- CHANNEL KEYWORDS ---------- */}
          <SectionTitle note="hidden from viewers">Channel keywords</SectionTitle>
          {d.keywords.length > 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-xs leading-relaxed text-slate-500">
                  Set once for the whole channel in YouTube Studio, and invisible on the
                  channel page — the channel-level equivalent of a video&rsquo;s tags.
                </p>
                <CopyButton
                  text={() => d.keywords.join(", ")}
                  label="Copy keywords"
                  copiedLabel="Copied"
                  title="Copy the channel keywords, comma separated"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {/* Keyed by POSITION, not by value: a channel can list the same
                    keyword twice (and real ones do — @ambiancast has "science"
                    and "history" duplicated), which makes the value a
                    non-unique key and gets chips silently dropped. We show the
                    list exactly as the channel set it, duplicates included,
                    because the duplication is itself worth seeing. */}
                {d.keywords.map((k, i) => (
                  <span
                    key={`${k}-${i}`}
                    className="rounded-lg bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/[0.07]"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 px-5 py-6 text-center text-sm text-slate-600">
              This channel has no keywords set.
            </p>
          )}

          {/* ---------- TOPICS ---------- */}
          {d.topics.length > 0 && (
            <>
              <SectionTitle note="assigned by Google">Topics</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {/* Same reasoning as the keywords above — topic labels collapse
                    to their last path segment, so two distinct Wikipedia
                    categories can arrive with the same display name. */}
                {d.topics.map((t, i) => (
                  <span
                    key={`${t}-${i}`}
                    className="rounded-lg bg-white/[0.03] px-2.5 py-1 text-xs text-slate-400 ring-1 ring-white/[0.07]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </>
          )}

          <p className="mt-10 text-[11px] leading-relaxed text-slate-600">
            Recent-performance figures come from this channel&rsquo;s last{" "}
            {s.sampleSize} public uploads ({RECENT_VIDEOS} max), not its whole history.
            Subscriber counts are rounded by YouTube itself. Nothing here is private
            data — it is all published through YouTube&rsquo;s API.
            {" "}
            <span className="text-slate-500">
              The pass/fail thresholds are our own rules of thumb, not
              YouTube&rsquo;s — nobody outside YouTube has the data to set them
              precisely. Treat a red mark as somewhere worth looking, not a verdict.
            </span>
          </p>
        </div>
      )}
    </>
  );
}

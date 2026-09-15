import type { Metadata } from "next";
import Link from "next/link";
import { ChannelAnalyzer } from "@/components/ChannelAnalyzer";
import { FREE_DAILY_LOOKUPS } from "@/lib/limits";
import { RECENT_VIDEOS } from "@/lib/youtube-channel";

export const metadata: Metadata = {
  // Leads on "audit" because that is the searched term with intent behind it —
  // someone typing it wants to be told what is wrong, not shown a dashboard.
  // "Analyzer" is kept in the title because the tool does both.
  title: "YouTube Channel Audit — Free Channel Analyzer",
  description:
    "Audit any YouTube channel in one click: what's missing from the profile, which " +
    "recent videos have no tags or descriptions, how the posting cadence and " +
    "engagement compare — with specific fixes. Free, no account needed.",
  alternates: { canonical: "/tools/channel-analyzer" },
};

/**
 * Unlike the tag generator, this one SPENDS QUOTA — three units per analysis —
 * so it counts against the visitor's lookup allowance and the badge says so.
 * Advertising it as free the way the tag generator is would be a lie the first
 * time someone hit the daily cap on it.
 */
export default function ChannelAnalyzerPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Free — uses one of your {FREE_DAILY_LOOKUPS} daily lookups
          </span>

          <h1 className="mt-6 text-balance bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-4xl font-bold leading-[1.1] tracking-tight text-transparent sm:text-5xl">
            Audit any YouTube channel
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-slate-400">
            Paste a channel and get a graded checklist — what the profile is missing,
            which recent videos have no tags or description, how the cadence and
            engagement actually compare — plus the specific things to fix. Built from
            its last {RECENT_VIDEOS} uploads, not its whole history.
          </p>
        </div>

        <ChannelAnalyzer />

        <div className="mt-16 border-t border-white/[0.07] pt-8">
          <p className="text-sm leading-relaxed text-slate-500">
            Looking at one video rather than a whole channel?{" "}
            <Link href="/" className="text-sky-300 underline-offset-4 hover:underline">
              Look it up by URL
            </Link>{" "}
            — or read{" "}
            <Link
              href="/guides/what-youtube-data-is-public"
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              what YouTube data is public
            </Link>{" "}
            to see where the limits are.
          </p>
        </div>
      </div>
    </main>
  );
}

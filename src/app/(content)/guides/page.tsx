import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Guides",
  description:
    "Plain explanations of YouTube metadata — what tags are and whether they matter, " +
    "how hashtag limits actually work, and which YouTube data is genuinely public.",
  alternates: { canonical: "/guides" },
};

/**
 * Guides index.
 *
 * ONE LIST, ADDED TO BY HAND. A generated index would be less work exactly once
 * and would then need the same judgement calls — order, which blurb, whether a
 * draft belongs in it — bolted back on. Three entries do not need a CMS.
 *
 * Order is editorial: tags first because it is what people arrive looking for.
 */
const GUIDES = [
  {
    href: "/guides/youtube-video-tags",
    title: "YouTube video tags: how to see them, and what they're worth",
    blurb:
      "Tags are invisible on the watch page and public in the API. How to read any video's, how channel keywords differ, and an honest answer on ranking.",
    minutes: 6,
  },
  {
    href: "/guides/youtube-hashtags",
    title: "YouTube hashtags: the 15 limit, and the 3 that actually get seen",
    blurb:
      "Go over fifteen and YouTube ignores every hashtag on the video. Only the first three appear above your title. The two rules that matter.",
    minutes: 4,
  },
  {
    href: "/guides/what-youtube-data-is-public",
    title: "What YouTube data is public — and what no tool can show you",
    blurb:
      "Dislikes, revenue, watch time and member counts are not available to anyone outside Studio — at video or channel level. Where the wall actually is, tested.",
    minutes: 7,
  },
] as const;

export default function GuidesPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
          Guides
        </h1>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-slate-400">
          What YouTube publishes about a video and a channel, what it keeps back, and
          what to do with the parts you can read. Written from working against the API
          directly, so the limits here are the real ones.
        </p>

        <div className="mt-10 space-y-3">
          {GUIDES.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="block rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 transition hover:border-sky-400/30 hover:bg-sky-400/[0.04]"
            >
              <h2 className="text-pretty text-base font-medium text-slate-100">
                {g.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{g.blurb}</p>
              <p className="mt-3 text-[11px] text-slate-600">{g.minutes} min read</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { TagGenerator } from "@/components/TagGenerator";
import { MAX_HASHTAGS, MAX_TAGS_CHARS } from "@/lib/tags";

/**
 * The first page under /tools.
 *
 * Free and ungated for everyone, signed in or not, because it spends no
 * YouTube quota — see api/tags/route.ts. It is also the cheapest way someone
 * discovers the site: a creator looking for tags lands here, and the lookup
 * product is one click away in the header.
 */
export const metadata: Metadata = {
  title: "YouTube Tag & Hashtag Generator",
  description:
    "Generate YouTube tags and hashtags from a topic, drawn from what people actually " +
    "search for on YouTube. Pick the ones you want and copy them, inside YouTube's " +
    "500-character tag limit and 15-hashtag cap.",
  alternates: { canonical: "/tools/tag-generator" },
};

export default function TagGeneratorPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Free — no account, no lookup used
          </span>

          <h1 className="mt-6 text-balance bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-4xl font-bold leading-[1.1] tracking-tight text-transparent sm:text-5xl">
            YouTube tag &amp; hashtag generator
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-slate-400">
            Describe your video and get tags built from what people actually search for
            on YouTube — packed to fit the {MAX_TAGS_CHARS}-character limit Studio
            enforces, plus hashtags for your description, up to the {MAX_HASHTAGS}{" "}
            YouTube will honour.
          </p>
        </div>

        <TagGenerator />

        <div className="mt-16 border-t border-white/[0.07] pt-8">
          <p className="text-sm leading-relaxed text-slate-500">
            Want to see the tags a video is already using?{" "}
            <Link href="/" className="text-sky-300 underline-offset-4 hover:underline">
              Look it up by URL
            </Link>{" "}
            — TubeData shows the full tag list alongside every other public field.
          </p>
        </div>
      </div>
    </main>
  );
}

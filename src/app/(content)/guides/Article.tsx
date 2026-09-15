import Link from "next/link";

/**
 * Shared shell for the guides.
 *
 * WHY THESE PAGES EXIST AT ALL: the site is four screens of UI, and a search
 * engine has almost nothing to read. The explanations were already written —
 * they were just buried inside `Explainers.tsx` and `field-info.ts`, behind
 * folds, on a page that only renders after someone runs a lookup. A crawler
 * never sees any of it. These pages put that knowledge somewhere it can be
 * read, linked to, and found.
 *
 * Everything here is ORIGINAL and comes from working against the YouTube API
 * directly — quota costs, which fields are reachable with an API key and which
 * need OAuth, the hashtag cliff. That is the part competitors cannot copy from
 * a template, and the only kind of content worth publishing.
 *
 * The JSON-LD is emitted per page rather than centrally: the type differs
 * (Article, FAQPage) and a wrong `@type` is worse than none.
 */

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Next has no first-class API for structured data; this is the documented
      // approach. The object is ours, never user input, so there is nothing to
      // escape — but keep it that way: interpolating a video title or a tag
      // from the API into this would be an injection into a <script> tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-slate-400">
      {children}
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="!mt-12 text-xl font-semibold tracking-tight text-slate-100">
      {children}
    </h2>
  );
}

export function Key({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-slate-200">{children}</strong>;
}

/** A fact worth pulling out of the paragraph flow. */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="!mt-8 rounded-2xl border border-sky-400/20 bg-sky-400/[0.05] px-5 py-4 text-sm leading-relaxed text-sky-100/90">
      {children}
    </div>
  );
}

export function ArticleShell({
  title,
  standfirst,
  updated,
  children,
}: {
  title: string;
  standfirst: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <article className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <Link
          href="/guides"
          className="text-xs text-slate-500 transition hover:text-sky-300"
        >
          ← Guides
        </Link>

        <h1 className="mt-5 text-balance text-3xl font-bold leading-tight tracking-tight text-slate-100 sm:text-4xl">
          {title}
        </h1>

        <p className="mt-4 text-pretty text-base leading-relaxed text-slate-400">
          {standfirst}
        </p>

        <p className="mt-4 text-xs text-slate-600">Updated {updated}</p>

        {children}

        {/* Every guide ends at the tool it explains. The point of the writing is
            to be useful on its own; the link is there for the reader who is now
            ready to do the thing. */}
        <div className="mt-16 rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7">
          <p className="text-sm font-medium text-slate-200">Try it on a real video</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Paste any YouTube URL and see the full public record — tags included, in the
            order the uploader wrote them.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Look up a video
            </Link>
            <Link
              href="/tools/tag-generator"
              className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white"
            >
              Generate tags
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}

import { SUPPORT_EMAIL } from "@/lib/support";

/**
 * Deliberately one muted line.
 *
 * The home page is kept minimal on purpose, so this is not a place for links,
 * marketing, or a sitemap. It exists because a site taking payments needs a
 * reachable contact address — card networks and Stripe expect one — and because
 * the refund flow promises a reply by email.
 *
 * `mt-auto` pins it to the bottom of the flex column in layout.tsx, so it never
 * floats up under short pages.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-5 text-xs text-slate-600">
        <span>
          TubeData<span className="text-slate-700">.io</span>
        </span>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="ml-auto transition hover:text-sky-300"
        >
          Contact us — {SUPPORT_EMAIL}
        </a>
      </div>
    </footer>
  );
}

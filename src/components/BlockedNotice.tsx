import { SUPPORT_EMAIL } from "@/lib/support";

/**
 * What a suspended account sees instead of the site.
 *
 * Rendered by the root layout in place of the page, so it covers every route
 * at once — including ones added later, which is the point of putting it there
 * rather than in each page. It is not the security boundary, though: the API
 * routes refuse a blocked user independently, because a page that merely
 * declines to render is trivially bypassed by calling the endpoint directly.
 *
 * The reason the admin typed is shown verbatim. Someone who cannot find out
 * why they were suspended cannot appeal, and cannot stop doing whatever it was.
 */
export function BlockedNotice({ reason }: { reason: string | null }) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-xl px-6 pb-24 pt-24">
        <div className="rounded-3xl border border-red-400/20 bg-red-400/[0.04] p-8 text-center">
          <span
            aria-hidden="true"
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-400/10 text-2xl"
          >
            🚫
          </span>

          <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-100">
            Your account is suspended
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            An administrator has blocked this account, so it can&rsquo;t be used to
            look up videos or make purchases.
          </p>

          {reason && (
            <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Reason given
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{reason}</p>
            </div>
          )}

          <p className="mt-6 text-sm text-slate-400">
            Think this is a mistake? Email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-sky-300 underline-offset-4 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

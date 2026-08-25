/**
 * Collapsible explainer row. Native <details>, so it costs no JavaScript,
 * works before hydration, and is searchable by the browser's find-in-page
 * in supporting browsers.
 */
export function Fold({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-t border-white/[0.06] py-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] text-slate-400 transition hover:text-white">
        {summary}
        <span
          aria-hidden="true"
          className="shrink-0 text-slate-600 transition group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-400">{children}</div>
    </details>
  );
}

/**
 * A titled group of folds.
 *
 * No lead paragraph by design — every word of explanation lives inside a fold,
 * so the only always-visible text is the title and the fold summaries. This
 * section sits under the tool and must not compete with it.
 */
export function ExplainerGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-7 first:mt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </h3>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Inline code chip, for the handful of literals these write-ups mention. */
export function Lit({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[12px] text-slate-300">
      {children}
    </code>
  );
}

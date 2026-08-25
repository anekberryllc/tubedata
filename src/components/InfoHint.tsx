"use client";

import { useState } from "react";
import { FIELD_INFO } from "@/lib/field-info";

/**
 * Small "?" affordance beside a section heading. Click toggles a panel
 * explaining what the field is and where it lives on YouTube itself.
 */
export function InfoHint({ field }: { field: keyof typeof FIELD_INFO }) {
  const [open, setOpen] = useState(false);
  const info = FIELD_INFO[field];
  if (!info) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Hide explanation" : "Show explanation"}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold leading-none transition ${
          open
            ? "border-sky-400/60 bg-sky-400/20 text-sky-200"
            : "border-white/15 bg-white/5 text-slate-400 hover:border-sky-400/40 hover:text-sky-300"
        }`}
      >
        ?
      </button>

      {open && (
        <div className="mt-2 w-full basis-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-relaxed">
          <p className="text-slate-300">{info.what}</p>
          <div className="mt-3 flex gap-2.5">
            <span
              className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                info.hidden
                  ? "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/25"
                  : "bg-sky-400/10 text-sky-300 ring-1 ring-sky-400/25"
              }`}
            >
              {info.hidden ? "Hidden" : "On YouTube"}
            </span>
            <p className="text-slate-400">{info.where}</p>
          </div>
        </div>
      )}
    </>
  );
}

/** Section heading with the explanation toggle attached. */
export function SectionHeading({
  children,
  field,
  count,
  action,
}: {
  children: React.ReactNode;
  field?: keyof typeof FIELD_INFO;
  count?: React.ReactNode;
  /** Optional control pinned to the right of the heading row, e.g. a copy button. */
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {children}
      </h3>
      {count !== undefined && (
        <span className="text-[11px] tabular-nums text-slate-600">{count}</span>
      )}
      {field && <InfoHint field={field} />}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

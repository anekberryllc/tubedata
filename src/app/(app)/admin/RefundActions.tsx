"use client";

import { useState, useTransition } from "react";
import { setRefundStatus } from "./actions";
import { REFUND_STATUSES, type RefundStatus } from "@/lib/refund-status";

/**
 * The decision buttons on a refund request.
 *
 * Single click, no confirmation step — unlike blocking an account, nothing
 * here is destructive and every status is reachable from every other, so a
 * misclick is one more click to undo. The irreversible part, actually sending
 * the money back, happens in Stripe and deliberately not here.
 */
const LABELS: Record<RefundStatus, { label: string; className: string }> = {
  open: {
    label: "Reopen",
    className:
      "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white",
  },
  approved: {
    label: "Approve",
    className:
      "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20",
  },
  refunded: {
    label: "Mark refunded",
    className: "border-sky-400/30 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20",
  },
  declined: {
    label: "Decline",
    className: "border-red-400/25 bg-red-400/[0.07] text-red-200 hover:bg-red-400/15",
  },
};

export function RefundActions({
  id,
  status,
}: {
  id: number;
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set(next: RefundStatus) {
    setError(null);
    startTransition(async () => {
      const result = await setRefundStatus(id, next);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap justify-end gap-2">
        {REFUND_STATUSES.filter((s) => s !== status).map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => set(s)}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${LABELS[s].className}`}
          >
            {LABELS[s].label}
          </button>
        ))}
      </div>
      {error && (
        <p className="max-w-xs text-right text-[11px] leading-relaxed text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

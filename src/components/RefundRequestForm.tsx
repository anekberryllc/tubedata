"use client";

import { useState } from "react";

type ExistingRequest = {
  id: number;
  status: string;
  reason: string | null;
  createdAt: string;
} | null;

const STATUS_COPY: Record<string, { label: string; tone: string; note: string }> = {
  open: {
    label: "Under review",
    tone: "bg-amber-400/10 text-amber-300 ring-amber-400/25",
    note: "We have your request and will get back to you by email.",
  },
  approved: {
    label: "Approved",
    tone: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25",
    note: "Approved — the refund is being processed through Stripe.",
  },
  refunded: {
    label: "Refunded",
    tone: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25",
    note: "Refunded. It can take a few days to appear on your statement.",
  },
  declined: {
    label: "Declined",
    tone: "bg-red-400/10 text-red-300 ring-red-400/25",
    note: "This request was declined. Reply to our email if you think that is wrong.",
  },
};

export function RefundRequestForm({ existing }: { existing: ExistingRequest }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // An already-open request is shown instead of the form: submitting three more
  // does not make a refund arrive faster, it just clogs the queue.
  const current = submitted
    ? { status: "open", createdAt: new Date().toISOString(), id: 0, reason }
    : existing;

  if (current) {
    const copy = STATUS_COPY[current.status] ?? STATUS_COPY.open;
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${copy.tone}`}
          >
            {copy.label}
          </span>
          <span className="text-xs text-slate-500">
            Requested {new Date(current.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-400">{copy.note}</p>
        {current.reason && (
          <p className="mt-3 border-l-2 border-white/10 pl-3 text-sm italic text-slate-500">
            {current.reason}
          </p>
        )}
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();

      if (json.ok) {
        setSubmitted(true);
        return;
      }
      setError(json.message ?? "Could not send that request.");
    } catch {
      setError("Network error — please try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <label htmlFor="refund-reason" className="text-sm text-slate-400">
        Tell us what went wrong and we&apos;ll take a look. Refunds are reviewed by a
        person, not issued automatically.
      </label>
      <textarea
        id="refund-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="What happened?"
        className="mt-3 w-full resize-y rounded-xl border border-white/[0.07] bg-black/30 p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy || !reason.trim()}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white disabled:opacity-40"
        >
          {busy ? "Sending…" : "Request a refund"}
        </button>
        <span className="text-xs text-slate-600">{reason.length}/2000</span>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </form>
  );
}

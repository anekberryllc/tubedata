"use client";

import { useState, useTransition } from "react";
import { issueRefund, listChargesForRequest } from "./actions";
import type { RefundableCharge } from "@/lib/stripe-refunds";

/**
 * Sending money back, from the admin panel.
 *
 * This is the one control in the product that moves real money in a direction
 * that cannot be reversed, so the interaction is deliberately slower than
 * everything else around it:
 *
 *   - the charges are loaded on demand, so nothing appears until you ask;
 *   - a charge must be chosen explicitly, with what is still refundable on it
 *     shown next to it — there is no "just refund it" default;
 *   - the amount is editable, defaulting to the full remaining amount;
 *   - and the final button is behind a confirmation that states the exact
 *     figure and says plainly that it cannot be undone.
 *
 * None of this is the real protection — the server action re-checks the admin,
 * the ownership of the charge, the amount, and whether this request was
 * already refunded. This is here so a person does not make that mistake in the
 * first place.
 */

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "America/New_York",
});

export function IssueRefund({ requestId }: { requestId: number }) {
  const [open, setOpen] = useState(false);
  const [charges, setCharges] = useState<RefundableCharge[] | null>(null);
  const [selected, setSelected] = useState<RefundableCharge | null>(null);
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load() {
    setError(null);
    setOpen(true);
    startTransition(async () => {
      const result = await listChargesForRequest(requestId);
      if (result.ok) {
        setCharges(result.charges);
        // Preselect only when there is genuinely no choice to make.
        const refundable = result.charges.filter((c) => c.refundableCents > 0);
        if (refundable.length === 1) {
          setSelected(refundable[0]);
          setAmount((refundable[0].refundableCents / 100).toFixed(2));
        }
      } else {
        setError(result.message);
      }
    });
  }

  function pick(charge: RefundableCharge) {
    setSelected(charge);
    setAmount((charge.refundableCents / 100).toFixed(2));
    setConfirming(false);
    setError(null);
  }

  // Parsed here as well as validated on the server, so the confirmation can
  // quote the exact figure that will be sent.
  const cents = Math.round(Number(amount) * 100);
  const valid =
    selected !== null &&
    Number.isFinite(cents) &&
    cents > 0 &&
    cents <= selected.refundableCents;

  function submit() {
    if (!selected || !valid) return;
    setError(null);
    startTransition(async () => {
      const result = await issueRefund(requestId, selected.id, cents);
      if (result.ok) {
        setOpen(false);
        setConfirming(false);
      } else {
        setError(result.message);
        setConfirming(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={load}
        className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[12px] font-medium text-amber-200 transition hover:bg-amber-400/20"
      >
        Refund money…
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-3 text-left sm:w-96">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-200/80">
          Refund through Stripe
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirming(false);
          }}
          className="text-[11px] text-slate-500 transition hover:text-slate-300"
        >
          Close
        </button>
      </div>

      {pending && !charges && (
        <p className="mt-2 text-[12px] text-slate-400">Loading payments…</p>
      )}

      {charges && charges.length === 0 && (
        <p className="mt-2 text-[12px] text-slate-400">
          Stripe has no successful payments for this customer.
        </p>
      )}

      {charges && charges.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {charges.map((c) => {
            const spent = c.refundableCents === 0;
            return (
              <button
                key={c.id}
                type="button"
                disabled={spent || pending}
                onClick={() => pick(c)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-2.5 py-2 text-left text-[12px] transition ${
                  selected?.id === c.id
                    ? "border-amber-400/50 bg-amber-400/10 text-slate-100"
                    : "border-white/10 bg-black/20 text-slate-300 hover:border-white/25"
                } ${spent ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate">
                    {c.description ?? "Payment"}
                  </span>
                  <span className="block text-[10px] text-slate-500">
                    {when.format(c.created)} · {c.id}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="block">{usd(c.amountCents)}</span>
                  <span className="block text-[10px] text-slate-500">
                    {spent
                      ? "fully refunded"
                      : `${usd(c.refundableCents)} refundable`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <>
          <label className="mt-3 block text-[11px] text-slate-400">
            Amount to refund
            <span className="ml-1 text-slate-600">
              (max {usd(selected.refundableCents)})
            </span>
            <input
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setConfirming(false);
              }}
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[13px] tabular-nums text-slate-100 focus:border-amber-400/40 focus:outline-none"
            />
          </label>

          {!confirming ? (
            <button
              type="button"
              disabled={!valid || pending}
              onClick={() => setConfirming(true)}
              className="mt-3 w-full rounded-lg bg-amber-400 px-3 py-2 text-[13px] font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Refund {valid ? usd(cents) : "…"}
            </button>
          ) : (
            <div className="mt-3 rounded-lg border border-red-400/30 bg-red-400/[0.07] p-2.5">
              <p className="text-[12px] leading-relaxed text-red-100">
                Send <span className="font-semibold">{usd(cents)}</span> back to{" "}
                {selected.id}? This moves real money and cannot be undone.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={submit}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                >
                  {pending ? "Refunding…" : `Yes, refund ${usd(cents)}`}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="rounded-lg px-3 py-1.5 text-[12px] text-slate-400 transition hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="mt-2 text-[11px] leading-relaxed text-red-300">{error}</p>
      )}
    </div>
  );
}

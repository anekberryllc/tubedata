"use client";

import { useState } from "react";

/**
 * Hands off to Stripe's hosted Customer Portal, where cancelling, changing the
 * card, and downloading invoices all live. We deliberately do not rebuild any
 * of that — Stripe's portal is authoritative, and a cancel button of our own
 * would be a second source of truth for subscription state.
 */
export function ManageSubscription() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();

      if (json.ok && json.url) {
        window.location.assign(json.url); // cross-origin: router.push cannot do this
        return;
      }
      setError(json.message ?? "Could not open the billing portal.");
    } catch {
      setError("Network error — please try again.");
    }
    setBusy(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={openPortal}
        disabled={busy}
        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-40"
      >
        {busy ? "Opening…" : "Manage subscription"}
      </button>
      <p className="mt-2 text-xs text-slate-600">
        Opens Stripe, where you can cancel, change your card, or download invoices.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

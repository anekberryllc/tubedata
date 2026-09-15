"use client";

import { useState } from "react";
import { useAuthDialog } from "./AuthDialog";
import { rememberPurchase } from "./PendingPurchase";
import { LOOKUP_PACKS, formatUsd } from "@/lib/lookup-packs";
import { TAX_NOTE_SHORT } from "@/lib/pricing";

/**
 * Prepaid lookup packs. Requires an account — unlike a donation, this grants a
 * balance that has to live somewhere, so a 401 opens the sign-in dialog rather
 * than failing.
 */
export function BuyLookups({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { open: openAuthDialog } = useAuthDialog();

  async function buy(pack: string) {
    setBusy(pack);
    setError(null);

    try {
      const res = await fetch("/api/stripe/buy-lookups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });

      if (res.status === 401) {
        // Signing in is a full redirect, so park the intent where it can
        // survive it. PendingPurchase picks it up and continues to Stripe.
        rememberPurchase({ type: "pack", pack });
        setBusy(null);
        openAuthDialog("unlock");
        return;
      }

      const json = await res.json();
      if (json.ok && json.url) {
        window.location.assign(json.url); // hand off to Stripe Checkout
        return;
      }
      setError(json.message ?? "Could not start checkout.");
    } catch {
      setError("Network error — please try again.");
    }
    setBusy(null);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {LOOKUP_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => buy(p.id)}
            disabled={busy !== null}
            className={`flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-sky-400/40 hover:bg-sky-400/[0.08] hover:text-sky-100 disabled:opacity-40 ${
              compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
            }`}
          >
            <span className="font-semibold">{p.credits}</span>
            <span className="text-slate-500">lookups</span>
            <span className="tabular-nums">{busy === p.id ? "…" : formatUsd(p.amount)}</span>
          </button>
        ))}
      </div>
      {/* Packs carry a tax code too, so they are taxed exactly like the
          subscription. One note inside this component covers every place packs
          are offered — the pricing page, the account page and the daily-limit
          banner — rather than three copies that can drift apart. */}
      <p className={`mt-2 text-slate-600 ${compact ? "text-[10px]" : "text-[11px]"}`}>
        {TAX_NOTE_SHORT.charAt(0).toUpperCase() + TAX_NOTE_SHORT.slice(1)} where
        applicable, shown at checkout.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}

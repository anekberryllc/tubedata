"use client";

import { useState } from "react";
import { useAuthDialog } from "./AuthDialog";
import { rememberPurchase } from "./PendingPurchase";

/**
 * Starts Stripe Checkout for Plus.
 *
 * Single implementation of the upgrade path — the locked history panel and the
 * daily-limit banner both use it, so the 401-means-sign-in handling only has to
 * be right once.
 */
export function UpgradeButton({
  label = "Get Plus",
  plan = "paid",
  className,
  onError,
}: {
  label?: string;
  plan?: "paid" | "pro";
  className?: string;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { open: openAuthDialog } = useAuthDialog();

  function fail(message: string) {
    setBusy(false);
    setError(message);
    onError?.(message);
  }

  async function upgrade() {
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (res.status === 401) {
        // Not signed in — open the same dialog the header uses, rather than
        // bouncing to Auth.js's unstyled default page. Park the intent first:
        // sign-in is a full redirect, and coming back with nothing having
        // happened reads as a broken button.
        rememberPurchase({ type: "plan", plan });
        setBusy(false);
        openAuthDialog("unlock");
        return;
      }

      const json = await res.json();
      if (json.ok && json.url) {
        window.location.assign(json.url); // hand off to Stripe Checkout
        return;
      }
      fail(json.message ?? "Could not start checkout.");
    } catch {
      fail("Network error — please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={upgrade}
        disabled={busy}
        className={
          className ??
          "rounded-lg bg-gradient-to-r from-amber-400 to-orange-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/10 transition hover:brightness-110 disabled:opacity-50"
        }
      >
        {busy ? "Starting…" : label}
      </button>
      {error && !onError && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </>
  );
}

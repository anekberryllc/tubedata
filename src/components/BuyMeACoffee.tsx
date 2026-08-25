"use client";

import { useEffect, useRef, useState } from "react";
import { DONATION_TIERS, formatUsd } from "@/lib/donations";

/**
 * Tip jar, as a header menu item.
 *
 * The dropdown is absolutely positioned rather than fixed: the header sets
 * `backdrop-blur`, which makes it a containing block for fixed descendants,
 * so a fixed panel here would be positioned against the header and clipped.
 * Outside clicks are caught with a document listener instead of a fixed
 * overlay, for the same reason.
 */
export function BuyMeACoffee() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function donate(tier: string) {
    setBusy(tier);
    setError(null);

    try {
      const res = await fetch("/api/stripe/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const json = await res.json();

      if (json.ok && json.url) {
        // assign() rather than `location.href =`: Checkout is cross-origin,
        // so a router push cannot do it.
        window.location.assign(json.url);
        return;
      }
      setError(json.message ?? "Could not start checkout.");
    } catch {
      setError("Network error — please try again.");
    }
    setBusy(null);
  }

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Support the free tier"
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition ${
          open
            ? "bg-amber-400/10 text-amber-200"
            : "text-slate-500 hover:bg-white/[0.04] hover:text-amber-200"
        }`}
      >
        <span aria-hidden="true">☕</span>
        <span className="hidden sm:inline">Buy me a coffee</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-64 rounded-2xl border border-white/10 bg-[#0b0f19] p-3 shadow-2xl shadow-black/60"
        >
          <p className="px-1 text-xs leading-relaxed text-slate-400">
            The lookup is free and always will be. A tip helps cover the API quota
            and server bill — it unlocks nothing.
          </p>

          <div className="mt-3 space-y-1.5">
            {DONATION_TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="menuitem"
                onClick={() => donate(t.id)}
                disabled={busy !== null}
                className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left text-[13px] text-slate-300 transition hover:border-amber-400/40 hover:bg-amber-400/[0.08] hover:text-amber-100 disabled:opacity-40"
              >
                <span aria-hidden="true">{t.emoji}</span>
                <span className="flex-1 font-medium">{t.label}</span>
                <span className="tabular-nums text-slate-500">
                  {busy === t.id ? "…" : formatUsd(t.amount)}
                </span>
              </button>
            ))}
          </div>

          {error && <p className="mt-2 px-1 text-xs text-red-400">{error}</p>}

          <p className="mt-3 px-1 text-[10px] text-slate-600">
            One-time payment via Stripe. No card details touch this site.
          </p>
        </div>
      )}
    </div>
  );
}

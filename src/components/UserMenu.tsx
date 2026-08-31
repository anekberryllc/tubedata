"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { subscribeCredits } from "./credits-channel";
import { UpgradeButton } from "./UpgradeButton";
import {
  formatUsd,
  PRO_PRICE_CENTS,
  ANNUAL_SAVING_PERCENT,
} from "@/lib/pricing";
import { PRO_ALLOWANCE_LABEL } from "@/lib/limits";

/**
 * Signed-in user menu.
 *
 * Same positioning constraint as the tip jar: the header sets `backdrop-blur`,
 * which makes it a containing block for fixed descendants, so this dropdown is
 * absolutely positioned and outside clicks are caught with a document listener
 * rather than a fixed overlay.
 */
export function UserMenu({
  email,
  name,
  image,
  planLabel,
  premium,
  viaAdmin,
  initialCredits,
  admin,
  signOutAction,
}: {
  email: string | null;
  name: string | null;
  image: string | null;
  planLabel: string;
  premium: boolean;
  /** Pro access that comes from the admin role, not from a subscription. */
  viaAdmin: boolean;
  /** Balance from the session at page load; kept current by credits-channel. */
  initialCredits: number;
  /** Draws the admin link. Not a permission — /admin re-checks server-side. */
  admin: boolean;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [credits, setCredits] = useState(initialCredits);
  const wrap = useRef<HTMLDivElement>(null);

  // Every lookup reports the balance after it ran, so the header follows along
  // instead of showing the number that was true when the page loaded.
  useEffect(() => subscribeCredits(setCredits), []);

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

  async function handleSignOut() {
    setPending(true);
    try {
      await signOutAction();
    } finally {
      // Don't leave the previous visitor's lookup pre-filled for the next one.
      try {
        sessionStorage.removeItem("lastLookup");
      } catch {
        /* sessionStorage can throw in locked-down browser modes */
      }
      // Hard navigation ON PURPOSE. router.push() is a soft navigation: server
      // components would re-render signed-out, but this client tree never
      // unmounts, so premium data already in React state would stay on screen.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    }
  }

  const label = name ?? email ?? "Account";
  const initial = (name ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-[13px] transition ${
          open ? "bg-white/[0.07] text-slate-100" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
        }`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-[11px] font-bold text-slate-950">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate sm:block">{label}</span>
        <span aria-hidden="true" className="text-[10px] text-slate-600">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f19] shadow-2xl shadow-black/60"
        >
          <div className="border-b border-white/[0.07] px-4 py-3">
            <p className="truncate text-[13px] font-medium text-slate-200">{name ?? "Signed in"}</p>
            {email && <p className="mt-0.5 truncate text-[11px] text-slate-500">{email}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                  premium
                    ? "bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-200 ring-1 ring-amber-400/30"
                    : "bg-white/5 text-slate-400 ring-1 ring-white/10"
                }`}
              >
                {planLabel}
              </span>
              {/* Without this an admin reads the Pro badge as a $9 charge they
                  don't remember making. */}
              {viaAdmin && (
                <span className="text-[10px] uppercase tracking-[0.1em] text-slate-600">
                  via admin
                </span>
              )}
              {/* Only shown once someone has actually bought lookups — a "0
                  prepaid remaining" on every free account would be noise. */}
              {credits > 0 && (
                <span className="text-[11px] tabular-nums text-sky-300">
                  ({credits} prepaid remaining)
                </span>
              )}
            </div>
          </div>

          {/* Only for accounts that don't already have Pro — `premium` is the
              access predicate, so admins and subscribers never see a pitch for
              something they already have.

              BOTH intervals are offered here rather than one button plus a link
              to the account page: Stripe Checkout is bought at a single price,
              so whichever interval this button carries is the one they are
              committed to by the time they see a payment form. The choice has
              to happen before the click, not after it. */}
          {!premium && (
            <div className="border-b border-white/[0.07] bg-gradient-to-r from-amber-400/[0.07] to-orange-400/[0.04] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-200/70">
                Upgrade to Pro
              </p>

              <div className="mt-2 flex flex-col gap-1.5">
                {/* Annual first, and styled as the primary action: it is the
                    better deal for them and the one worth defaulting to. */}
                <UpgradeButton
                  interval="year"
                  label={`${formatUsd(PRO_PRICE_CENTS.year)}/yr — save ${ANNUAL_SAVING_PERCENT}%`}
                  className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-2 text-[13px] font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
                />
                <UpgradeButton
                  interval="month"
                  label={`or ${formatUsd(PRO_PRICE_CENTS.month)}/mo`}
                  className="w-full rounded-xl border border-white/10 px-3 py-2 text-[13px] font-medium text-slate-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
                />
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                {PRO_ALLOWANCE_LABEL} and your saved history. Same Pro either way —
                you can switch later from the billing portal.
              </p>
            </div>
          )}

          <div className="p-1.5">
            {admin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-amber-200 transition hover:bg-amber-400/[0.08] hover:text-amber-100"
              >
                <span aria-hidden="true">🛡️</span>
                Admin panel
              </Link>
            )}

            <Link
              href="/history"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <span aria-hidden="true">🕘</span>
              Lookup history
            </Link>

            <Link
              href="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <span aria-hidden="true">⚙️</span>
              Manage account
            </Link>
          </div>

          <div className="border-t border-white/[0.07] p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={pending}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100 disabled:opacity-50"
            >
              <span aria-hidden="true">↪</span>
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

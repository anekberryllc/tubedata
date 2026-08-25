"use client";

import { useEffect, useRef, useState } from "react";

export const PENDING_PURCHASE_KEY = "pendingPurchase";

export type PurchaseIntent =
  | { type: "pack"; pack: string }
  | { type: "plan"; plan: "paid" | "pro" };

/**
 * Remember what the user was trying to buy before we sent them to sign in.
 *
 * Signing in is a full OAuth redirect, so React state does not survive it.
 * Without this, clicking "buy lookups" while signed out just logs you in and
 * drops the purchase on the floor — the user has to find the button again and
 * has no idea why nothing happened.
 */
export function rememberPurchase(intent: PurchaseIntent) {
  try {
    sessionStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(intent));
  } catch {
    /* sessionStorage can throw in locked-down browser modes */
  }
}

/**
 * Resumes that purchase once the user lands back on the site signed in.
 *
 * Mounted in the root layout so it works whatever page the OAuth redirect
 * returns to.
 */
export function PendingPurchase() {
  const ran = useRef(false);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    // StrictMode double-invokes effects, and this one creates a Stripe
    // Checkout session. Running it twice would make two.
    if (ran.current) return;
    ran.current = true;

    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PENDING_PURCHASE_KEY);
      // Clear BEFORE doing anything async: if the request fails we must not
      // leave an intent behind that retries on every future page load.
      if (raw) sessionStorage.removeItem(PENDING_PURCHASE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let intent: PurchaseIntent;
    try {
      intent = JSON.parse(raw);
    } catch {
      return;
    }

    const endpoint =
      intent.type === "pack" ? "/api/stripe/buy-lookups" : "/api/stripe/checkout";
    const body =
      intent.type === "pack" ? { pack: intent.pack } : { plan: intent.plan };

    // Deferred rather than called straight from the effect body: setting state
    // synchronously there triggers a cascading render (react-hooks/set-state-in-effect).
    queueMicrotask(() => setResuming(true));

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && json.url) {
          window.location.assign(json.url); // straight to Stripe Checkout
          return;
        }
        // Still signed out, or checkout refused. Drop it silently rather than
        // showing an error for something the user did not just click.
        setResuming(false);
      })
      .catch(() => setResuming(false));
  }, []);

  if (!resuming) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[80] flex justify-center p-3">
      <div className="rounded-xl border border-amber-400/25 bg-[#0b0f19] px-4 py-2 text-sm text-amber-200 shadow-2xl shadow-black/60">
        Taking you to checkout…
      </div>
    </div>
  );
}

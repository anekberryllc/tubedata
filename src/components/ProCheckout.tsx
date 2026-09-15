"use client";

import { useState } from "react";
import { UpgradeButton } from "./UpgradeButton";
import {
  ANNUAL_MONTHLY_EQUIVALENT_CENTS,
  ANNUAL_SAVING_PERCENT,
  PRO_PRICE_CENTS,
  TAX_NOTE,
  formatUsd,
  type BillingInterval,
} from "@/lib/pricing";

/**
 * The buy half of the Pro card: pick an interval, see that price, check out.
 *
 * A toggle here rather than the two stacked buttons used on the home page and
 * the account page. Those appear beside a result someone is already reading,
 * where a second CTA is an interruption; this page exists FOR the comparison,
 * so showing one price at a time and letting them switch is the clearer read.
 *
 * It takes the feature list as `children` so the card reads price → features →
 * button, the same order as the Free card beside it. The features themselves
 * stay server-rendered; only the price and the interval are interactive, and
 * wrapping is what keeps the two cards visually aligned without duplicating
 * that list into a client component.
 *
 * Checkout is still UpgradeButton — the single implementation of the
 * 401-opens-sign-in path. The interval changes the price, never the tier:
 * both buy the same Pro.
 */
export function ProCheckout({ children }: { children?: React.ReactNode }) {
  const [interval, setInterval] = useState<BillingInterval>("year");
  const annual = interval === "year";

  return (
    <div className="flex flex-1 flex-col">
      <div
        role="radiogroup"
        aria-label="Billing interval"
        className="mt-5 inline-flex self-start rounded-xl border border-white/10 bg-white/[0.03] p-1"
      >
        {(["year", "month"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={interval === value}
            onClick={() => setInterval(value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              interval === value
                ? "bg-white text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {value === "year" ? "Yearly" : "Monthly"}
            {value === "year" && (
              <span
                className={`ml-1.5 text-[10px] font-semibold ${
                  interval === "year" ? "text-emerald-600" : "text-emerald-400/80"
                }`}
              >
                −{ANNUAL_SAVING_PERCENT}%
              </span>
            )}
          </button>
        ))}
      </div>

      {/* THE BIG NUMBER IS THE AMOUNT THAT WILL BE CHARGED, and the unit beside
          it is the billing period it is charged over. Nothing else belongs in
          this position.

          It previously showed the annual plan as its per-month equivalent —
          "$4.50 /month" for a plan that takes $54 in one go. The arithmetic was
          right and the small print underneath said so, but the headline is what
          people read, and a headline that is not the price is misleading however
          correct the footnote is. The comparison figure is still worth showing;
          it just belongs below, not in the slot reserved for the price. */}
      <div className="mt-4 flex items-end gap-1.5">
        <span className="text-4xl font-bold tracking-tight tabular-nums text-white">
          {formatUsd(annual ? PRO_PRICE_CENTS.year : PRO_PRICE_CENTS.month)}
        </span>
        <span className="pb-1 text-sm text-slate-500">
          {annual ? "/year" : "/month"}
        </span>
      </div>

      <p className="mt-1.5 text-xs text-slate-500">
        {annual ? (
          <>
            Works out at {formatUsd(ANNUAL_MONTHLY_EQUIVALENT_CENTS)}/month — saves{" "}
            {ANNUAL_SAVING_PERCENT}% against {formatUsd(PRO_PRICE_CENTS.month)}/mo,
            billed once a year.
          </>
        ) : (
          <>
            Billed monthly. Yearly is {formatUsd(PRO_PRICE_CENTS.year)} — about{" "}
            {formatUsd(ANNUAL_MONTHLY_EQUIVALENT_CENTS)}/month.
          </>
        )}{" "}
        <span className="text-slate-600">All prices {TAX_NOTE}.</span>
      </p>

      {children}

      <div className="mt-auto pt-7">
        <UpgradeButton
          interval={interval}
          label={`Get Pro — ${formatUsd(
            annual ? PRO_PRICE_CENTS.year : PRO_PRICE_CENTS.month
          )}/${annual ? "yr" : "mo"}`}
          className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/10 transition hover:brightness-110 disabled:opacity-50"
        />
        <p className="mt-3 text-center text-[11px] text-slate-600">
          Cancel any time from your account. Refunds are reviewed by a person, not
          automatic.
        </p>
      </div>
    </div>
  );
}

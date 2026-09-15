import Stripe from "stripe";
import type { Plan } from "./plans";
import type { BillingInterval } from "./pricing";

if (!process.env.STRIPE_SECRET_KEY) {
  // Thrown lazily at call time rather than import time so the rest of the app
  // still runs before Stripe is configured.
  console.warn("STRIPE_SECRET_KEY is not set — billing endpoints will fail.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_missing");

/**
 * Stripe tax code for what we sell, REQUIRED on every line item.
 *
 * Managed Payments is enabled by default on this Stripe account and refuses to
 * create a Checkout Session for any line item whose product has no tax code:
 * "the product tax code is missing", HTTP 400. That is a hard failure of the
 * entire payment, not a reporting nicety, so any new line item needs one from
 * the start. Dashboard-created products carry their own; this constant is for
 * the line items built INLINE with `price_data`, which have no stored product
 * to inherit from.
 *
 * Managed Payments accepts only DIGITAL-SUPPLY codes. "Nontaxable"
 * (txcd_00000000) is rejected as ineligible, which is why donations do not
 * appear here — a tip is not a supply of anything, and rather than mislabel it
 * as software to satisfy the check, that one session opts out of Managed
 * Payments entirely. See the donate route.
 *
 * WHICH SaaS CODE IS A TAX DECISION, not a technical one: Stripe separates
 * "business use" from "personal use" and some US states treat them
 * differently. Business use is set here because the tool is bought by people
 * running channels. Revisit with an accountant if that is wrong.
 */
export const TAX_CODE = {
  SERVICE: "txcd_10103001",
} as const;

/**
 * Price IDs come from the Stripe dashboard; they differ per environment.
 *
 * One paid TIER (Pro) bought over two intervals. STRIPE_PRICE_PLUS is gone —
 * if you find it in an old .env, its value is the monthly price that
 * STRIPE_PRICE_PRO now holds.
 */
export const PRICE_BY_INTERVAL: Record<BillingInterval, string | undefined> = {
  month: process.env.STRIPE_PRICE_PRO,
  year: process.env.STRIPE_PRICE_PRO_ANNUAL,
};

/**
 * Reverse lookup: which plan does a Stripe price grant?
 *
 * BOTH intervals must map to "pro". The subscription webhook downgrades anyone
 * whose price it does not recognise, so omitting the annual id here would
 * quietly demote every annual subscriber to free at their next Stripe event.
 */
export function planForPrice(priceId: string | null | undefined): Plan {
  if (!priceId) return "free";
  const proPrices = [process.env.STRIPE_PRICE_PRO, process.env.STRIPE_PRICE_PRO_ANNUAL];
  return proPrices.includes(priceId) ? "pro" : "free";
}

/**
 * Subscription statuses that should keep premium access switched on.
 * `past_due` is included deliberately — Stripe retries failed payments for
 * days, and cutting someone off mid-retry generates support tickets from
 * people whose card simply expired.
 */
export const ACTIVE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

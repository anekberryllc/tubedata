import Stripe from "stripe";
import type { Plan } from "./plans";

if (!process.env.STRIPE_SECRET_KEY) {
  // Thrown lazily at call time rather than import time so the rest of the app
  // still runs before Stripe is configured.
  console.warn("STRIPE_SECRET_KEY is not set — billing endpoints will fail.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_missing");

/** Price IDs come from the Stripe dashboard; they differ per environment. */
export const PRICE_BY_PLAN: Record<Exclude<Plan, "free">, string | undefined> = {
  paid: process.env.STRIPE_PRICE_PLUS,
  pro: process.env.STRIPE_PRICE_PRO,
};

/** Reverse lookup: which plan does a Stripe price grant? */
export function planForPrice(priceId: string | null | undefined): Plan {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_PLUS) return "paid";
  return "free";
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

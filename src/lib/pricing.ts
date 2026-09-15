/**
 * Pro subscription pricing, in one place so displayed copy cannot drift.
 *
 * Two ways to buy the SAME tier. Billing interval is not a plan: an annual
 * subscriber's `users.plan` is "pro", exactly like a monthly one, and nothing
 * outside checkout and the pricing copy should care which they chose.
 *
 * THESE AMOUNTS MUST MATCH THE STRIPE PRICES they describe — STRIPE_PRICE_PRO
 * and STRIPE_PRICE_PRO_ANNUAL. Stripe is what actually charges the card; these
 * figures only decide what the page claims. If you change a price in the Stripe
 * dashboard, change it here in the same sitting or the site starts lying.
 */
export type BillingInterval = "month" | "year";

export const PRO_PRICE_CENTS: Record<BillingInterval, number> = {
  month: 900,
  year: 5400,
};

export const formatUsd = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

/** What twelve months would cost at the monthly rate — what annual undercuts. */
export const ANNUAL_AT_MONTHLY_RATE_CENTS = PRO_PRICE_CENTS.month * 12;

/**
 * Derived rather than written down, so the headline discount can never
 * contradict the prices above. Change either amount and the copy follows.
 */
export const ANNUAL_SAVING_PERCENT = Math.round(
  (1 - PRO_PRICE_CENTS.year / ANNUAL_AT_MONTHLY_RATE_CENTS) * 100
);

/** Annual expressed per month, which is how people actually compare the two. */
export const ANNUAL_MONTHLY_EQUIVALENT_CENTS = Math.round(PRO_PRICE_CENTS.year / 12);

export const isBillingInterval = (x: unknown): x is BillingInterval =>
  x === "month" || x === "year";

/**
 * Every price on this site is TAX-EXCLUSIVE.
 *
 * Managed Payments is enabled on the Stripe account, so Stripe calculates
 * sales tax from the customer's address and adds it on top. The first real
 * subscription proved it: a $54 annual plan was charged at $57.38, $54.00
 * subtotal plus $3.38 standard-rated tax. Advertising "$54" and taking $57.38
 * with no warning is the kind of surprise that produces chargebacks, so every
 * place a price is shown says this.
 *
 * WHY THE AMOUNT IS NOT SHOWN, only its existence: tax depends on where the
 * customer is, and we do not know that until Stripe Checkout collects their
 * address. Stripe shows the exact figure there, before they confirm. Anything
 * we printed earlier would be a guess, and a guess about money is worse than
 * an honest "it depends".
 *
 * Donations are exempt and must NOT carry this note — that route opts out of
 * Managed Payments entirely, so a tip is charged at exactly its face value.
 */
export const TAX_NOTE = "plus tax where applicable, shown at checkout";

/** The same point in the fewest words, for tight spaces beside a price. */
export const TAX_NOTE_SHORT = "plus tax";

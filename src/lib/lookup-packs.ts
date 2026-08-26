/**
 * Prepaid lookup packs — for people who want more than the 10 free daily
 * lookups but do not want a subscription.
 *
 * PRICING IS DELIBERATELY WORSE THAN PRO PER LOOKUP. Pro is $9/mo for
 * unlimited, so every pack has to stay above that on volume or it would
 * cannibalise the subscription. Packs are a convenience for occasional users,
 * not a cheaper route to the same thing.
 *
 * This constraint is why the tier collapse kept Pro at $9 rather than moving it
 * to $29 — at $29 the $11/50 pack undercuts the subscription for anyone doing
 * under roughly 145 lookups a month, and these numbers would need redoing.
 *
 * Credits never expire and are only spent AFTER the free daily allowance is
 * used up, so buying a pack never wastes the free lookups.
 */
export const LOOKUP_PACKS = [
  { id: "pack10", credits: 10, amount: 300 },
  { id: "pack20", credits: 20, amount: 500 },
  { id: "pack50", credits: 50, amount: 1100 },
] as const;

export type LookupPack = (typeof LOOKUP_PACKS)[number];

export const getPack = (id: string) => LOOKUP_PACKS.find((p) => p.id === id);

// One implementation of money formatting, shared with subscription pricing.
export { formatUsd } from "./pricing";

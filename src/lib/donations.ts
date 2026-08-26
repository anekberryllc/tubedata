/**
 * Tip amounts, in cents. A fixed list on the server, because the client must
 * never name its own price — an open `amount` field is a free-money bug.
 */
export const DONATION_TIERS = [
  { id: "coffee", amount: 300, label: "Coffee", emoji: "☕" },
  { id: "double", amount: 500, label: "Double shot", emoji: "☕☕" },
  { id: "beans", amount: 1000, label: "Bag of beans", emoji: "🫘" },
] as const;

export type DonationTier = (typeof DONATION_TIERS)[number];

// One implementation of money formatting, shared with subscription pricing.
export { formatUsd } from "./pricing";

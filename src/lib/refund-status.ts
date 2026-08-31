/**
 * The refund vocabulary, in a module with NO server imports.
 *
 * These names are needed in three places: the queries (server), the actions
 * (server), and the decision buttons (client). Keeping them here rather than
 * in admin-refunds.ts is not tidiness — that file imports @/db, and a client
 * component importing it drags the Neon client into the browser bundle, where
 * `DATABASE_URL is not set` throws at module evaluation and takes the whole
 * page down. Same rule as lib/limits.ts.
 *
 * Every status here is SHOWN TO THE REQUESTER on their account page
 * (components/RefundRequestForm.tsx). Changing or adding one changes what a
 * person reads about their own money, so keep the two in step.
 */
export const REFUND_STATUSES = ["open", "approved", "refunded", "declined"] as const;

export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const isRefundStatus = (v: string): v is RefundStatus =>
  (REFUND_STATUSES as readonly string[]).includes(v);

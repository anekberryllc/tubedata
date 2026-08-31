import {
  pgTable, text, integer, bigint, boolean, timestamp,
  jsonb, serial, primaryKey, index,
} from "drizzle-orm/pg-core";

/**
 * One row per video. Metadata changes rarely, so this is updated in place.
 */
export const videos = pgTable("videos", {
  videoId: text("video_id").primaryKey(),
  channelId: text("channel_id"),
  channelTitle: text("channel_title"),
  title: text("title"),
  description: text("description"),
  tags: text("tags").array(),
  topics: text("topics").array(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  hasCaptions: boolean("has_captions"),
  definition: text("definition"),
  categoryId: text("category_id"),
  language: text("language"),
  privacyStatus: text("privacy_status"),
  madeForKids: boolean("made_for_kids"),
  embeddable: boolean("embeddable"),
  licensedContent: boolean("licensed_content"),
  thumbnail: text("thumbnail"),
  regionRestriction: jsonb("region_restriction"),

  // Full untouched API response — lets us extract fields we didn't plan for,
  // without refetching every video already in the table.
  raw: jsonb("raw"),

  // available | not_found | private | deleted. Negative results are cached too,
  // so a dead URL doesn't cost a quota unit on every lookup.
  status: text("status").notNull().default("available"),

  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("videos_channel_idx").on(t.channelId),
  index("videos_fetched_idx").on(t.fetchedAt),
]);

/**
 * Append-only statistics snapshots. Never updated — every fetch adds a row.
 * This is the history YouTube's API cannot give you, and the basis of the paid tier.
 */
export const videoStats = pgTable("video_stats", {
  videoId: text("video_id").notNull().references(() => videos.videoId, { onDelete: "cascade" }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  viewCount: bigint("view_count", { mode: "number" }),
  likeCount: bigint("like_count", { mode: "number" }),
  commentCount: bigint("comment_count", { mode: "number" }),
}, (t) => [
  primaryKey({ columns: [t.videoId, t.capturedAt] }),
  index("stats_video_time_idx").on(t.videoId, t.capturedAt),
]);

/**
 * Every lookup request. Drives per-user metering and quota accounting later.
 */
export const lookups = pgTable("lookups", {
  id: serial("id").primaryKey(),
  videoId: text("video_id"),
  sourceUrl: text("source_url").notNull(),
  cacheHit: boolean("cache_hit").notNull(),
  quotaUnits: integer("quota_units").notNull().default(0),
  userId: text("user_id"),                 // null until auth lands
  ipAddress: text("ip_address"),           // for anonymous rate limiting
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("lookups_time_idx").on(t.requestedAt),
  index("lookups_ip_time_idx").on(t.ipAddress, t.requestedAt),
  // Drives the per-user history page, which always filters by user and
  // orders by time — without this it degrades into a full table scan.
  index("lookups_user_time_idx").on(t.userId, t.requestedAt),
]);

/**
 * Refund requests, awaiting a human.
 *
 * Deliberately a queue rather than an automatic Stripe refund: issuing money
 * back is irreversible and needs a person to look at it. The account page
 * records the request and shows its status; you action it in Stripe.
 */
export const refundRequests = pgTable("refund_requests", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  // Snapshotted at request time — the user row can change afterwards, and the
  // request should still say who asked and what they were on.
  email: text("email"),
  plan: text("plan"),
  stripeCustomerId: text("stripe_customer_id"),
  reason: text("reason"),
  // open | approved | declined | refunded
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),

  // The refund itself, once money has actually moved. stripeRefundId is the
  // proof it happened: the action refuses to refund a request that has one,
  // and a partial unique index makes the database refuse a duplicate too.
  // Camel-cased and quoted to match the columns added alongside it.
  stripeRefundId: text("stripeRefundId"),
  stripeChargeId: text("stripeChargeId"),
  refundedAmountCents: integer("refundedAmountCents"),
  /** The admin who authorised the money leaving. Kept for audit. */
  refundedBy: text("refundedBy"),
}, (t) => [
  index("refund_user_idx").on(t.userId, t.createdAt),
]);

/**
 * One row per completed "buy me a coffee" tip.
 *
 * Recorded ONLY so the tips are visible and countable in the product — a
 * donation grants nothing. Nothing in this table may ever be read to decide
 * entitlement; see the webhook, where the donation branch is deliberately kept
 * away from the code that sets `users.plan`.
 *
 * `userId` is nullable on purpose: tipping does not require an account, and
 * refusing to record anonymous tips would lose the majority of them. `email` is
 * snapshotted from the Stripe session so an anonymous tipper can still be
 * thanked.
 *
 * UNIQUE on the session id for the same reason as credit_purchases: Stripe
 * retries webhooks, and a redelivery must not double-count the tip.
 */
export const donations = pgTable("donations", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  /** Which preset tier was clicked, e.g. "coffee". */
  tierId: text("tier_id"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("donations_user_idx").on(t.userId, t.createdAt),
  index("donations_time_idx").on(t.createdAt),
]);

/**
 * One row per completed lookup-pack purchase.
 *
 * Exists for idempotency as much as for audit: Stripe retries webhooks, and
 * without a UNIQUE key on the session id a redelivery would grant the credits
 * twice. The webhook inserts here first and only tops up the balance if the
 * insert actually created a row.
 */
export const creditPurchases = pgTable("credit_purchases", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  packId: text("pack_id"),
  credits: integer("credits").notNull(),
  amountCents: integer("amount_cents"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("credit_purchase_user_idx").on(t.userId, t.createdAt),
]);

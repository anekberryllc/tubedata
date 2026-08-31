/**
 * Migration: record the Stripe refund itself on a refund request.
 *
 *   node --env-file=.env.local scripts/add-refund-execution.mjs
 *
 * Idempotent. These columns are what make issuing a refund from the admin
 * panel safe to expose: `stripeRefundId` is the proof that money already went
 * back, and the code refuses to refund a request that has one. Without it, a
 * double click is a double refund.
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

await sql`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS "stripeRefundId" text`;
await sql`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS "stripeChargeId" text`;
await sql`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS "refundedAmountCents" integer`;
/** The admin's user id — who authorised the money leaving. */
await sql`ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS "refundedBy" text`;

// One refund per Stripe refund id. A belt-and-braces guard at the database
// level: even if two requests somehow raced, Postgres refuses the second.
await sql`CREATE UNIQUE INDEX IF NOT EXISTS refund_stripe_refund_idx
          ON refund_requests ("stripeRefundId") WHERE "stripeRefundId" IS NOT NULL`;

const cols = await sql`SELECT column_name, data_type FROM information_schema.columns
                       WHERE table_schema='public' AND table_name='refund_requests'
                       ORDER BY ordinal_position`;
console.table(cols);

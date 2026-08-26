/**
 * End-to-end test: cancelling keeps Pro until the term ends, then drops to free.
 *
 *   node --env-file=.env.local scripts/test-cancellation.mjs
 *
 * Uses a Stripe TEST CLOCK so Stripe itself generates the real subscription
 * lifecycle events, then replays those events to the local webhook with a
 * genuine signature (generateTestHeaderString). Nothing is faked: the payloads
 * are Stripe's own, and they go through the same signature verification and
 * handler a live event would.
 *
 * Everything is created on a throwaway user and a throwaway customer, and torn
 * down at the end. The real account is never touched.
 */
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PRICE = process.env.STRIPE_PRICE_PRO;
const WEBHOOK = "http://localhost:3000/api/stripe/webhook";

const TEST_USER_ID = "test-cancel-flow-user";
let failures = 0;
let createdClockId = null;

const check = (label, got, want) => {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}: ${got}${ok ? "" : `  (expected ${want})`}`);
};

const planOf = async () => {
  const [r] = await sql`SELECT plan FROM "user" WHERE id = ${TEST_USER_ID}`;
  return r?.plan ?? "(no row)";
};

/** Post a real Stripe event object to the local webhook, correctly signed. */
async function deliver(event) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": header },
    body: payload,
  });
  return res.status;
}

/**
 * Newest event of a given type touching this subscription.
 *
 * Polled: events.list is eventually consistent, and an event created moments
 * ago is often not listed on the first call. Without the retry the test posts
 * `undefined` to the webhook and reads the resulting 400 as a product bug.
 */
async function latestEvent(type, subId, attempts = 15) {
  for (let i = 0; i < attempts; i++) {
    const evs = await stripe.events.list({ type, limit: 100 });
    const hit = evs.data.find((e) => e.data.object.id === subId);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`no ${type} event appeared for ${subId} after ${attempts} attempts`);
}

async function advanceTo(clockId, unixTime) {
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: unixTime });
  for (let i = 0; i < 60; i++) {
    const c = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (c.status === "ready") return;
    if (c.status === "internal_failure") throw new Error("test clock failed");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("test clock did not become ready in time");
}

async function main() {
  if (!SECRET) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

  const now = Math.floor(Date.now() / 1000);
  console.log("Setting up throwaway user, customer and subscription…\n");

  const clock = await stripe.testHelpers.testClocks.create({ frozen_time: now });
  createdClockId = clock.id;
  const customer = await stripe.customers.create({
    test_clock: clock.id,
    email: "cancel-flow@example.test",
    payment_method: "pm_card_visa",
    invoice_settings: { default_payment_method: "pm_card_visa" },
    metadata: { userId: TEST_USER_ID },
  });

  // A user row the webhook can find by stripe_customer_id, starting on free.
  await sql`DELETE FROM "user" WHERE id = ${TEST_USER_ID}`;
  await sql`INSERT INTO "user" (id, email, plan, "stripeCustomerId")
            VALUES (${TEST_USER_ID}, 'cancel-flow@example.test', 'free', ${customer.id})`;

  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: PRICE }],
  });
  const periodEnd = sub.items.data[0].current_period_end ?? sub.current_period_end;
  console.log(`   subscription ${sub.id}  status=${sub.status}`);
  console.log(`   term ends ${new Date(periodEnd * 1000).toLocaleString()}\n`);

  // ---------------------------------------------------------------- subscribe
  console.log("1. Subscription created — user should become Pro");
  check("plan before any event", await planOf(), "free");
  {
    const ev = await latestEvent("customer.subscription.created", sub.id);
    check("webhook accepted event", await deliver(ev), 200);
    check("plan after created", await planOf(), "pro");
  }

  // ------------------------------------------------------------ cancel at end
  console.log("\n2. User cancels — must STAY Pro until the term they paid for ends");
  const cancelled = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
  check("stripe cancel_at_period_end", cancelled.cancel_at_period_end, true);
  check("stripe status still", cancelled.status, "active");
  {
    const ev = await latestEvent("customer.subscription.updated", sub.id);
    check("webhook accepted event", await deliver(ev), 200);
    check("plan immediately after cancelling", await planOf(), "pro");
  }

  // -------------------------------------------------------- term actually ends
  console.log("\n3. Clock advances past the term end — Pro should now lapse to free");
  await advanceTo(clock.id, periodEnd + 3600);
  const after = await stripe.subscriptions.retrieve(sub.id);
  check("stripe status after term end", after.status, "canceled");
  {
    const ev = await latestEvent("customer.subscription.deleted", sub.id);
    if (!ev) {
      failures++;
      console.log("   FAIL  no customer.subscription.deleted event was generated");
    } else {
      check("webhook accepted event", await deliver(ev), 200);
      check("plan after term end", await planOf(), "free");
    }
  }

  // ---------------------------------------------------------------- teardown
  console.log("\nCleaning up…");
  await sql`DELETE FROM "user" WHERE id = ${TEST_USER_ID}`;
  await stripe.testHelpers.testClocks.del(clock.id); // removes customer + subscription
  const [gone] = await sql`SELECT COUNT(*)::int n FROM "user" WHERE id = ${TEST_USER_ID}`;
  console.log(`   test user rows remaining: ${gone.n}`);
  console.log(`   test clock deleted (customer and subscription with it)`);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("\nERROR:", e.message);
  await sql`DELETE FROM "user" WHERE id = ${TEST_USER_ID}`.catch(() => {});
  // Also bin the clock, which takes its customer and subscription with it.
  // Without this an abort mid-setup leaves Stripe fixtures behind, and there is
  // a hard cap on how many test clocks an account may hold.
  if (createdClockId) {
    await stripe.testHelpers.testClocks.del(createdClockId).catch(() => {});
    console.error("cleaned up test clock", createdClockId);
  }
  process.exit(1);
});

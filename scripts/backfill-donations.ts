/**
 * Record tips that were paid before the donations table existed, or that the
 * webhook missed because no listener was running.
 *
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-donations.ts
 *
 * Runs the SAME recordDonation() the webhook uses, so it cannot drift from live
 * behaviour, and is safe to re-run: the unique session id makes every pass after
 * the first a no-op.
 *
 * Stripe's session list does not filter on metadata, so this pages through
 * recent sessions and picks out kind=donation itself.
 */
import { stripe } from "@/lib/stripe";
import { recordDonation } from "@/lib/record-donation";

const PAGES = 5;
const PER_PAGE = 100;

async function main() {
  let startingAfter: string | undefined;
  let scanned = 0;
  let found = 0;
  let inserted = 0;

  for (let page = 0; page < PAGES; page++) {
    const batch = await stripe.checkout.sessions.list({
      limit: PER_PAGE,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const s of batch.data) {
      scanned++;
      if (s.metadata?.kind !== "donation") continue;
      found++;

      if (s.payment_status !== "paid") {
        console.log(`  skip  ${s.id.slice(0, 22)}…  ${s.payment_status} (never completed)`);
        continue;
      }

      // Re-fetched so payment_intent is expanded; the list endpoint returns it
      // as a bare id at best and recordDonation stores it.
      const full = await stripe.checkout.sessions.retrieve(s.id, {
        expand: ["payment_intent"],
      });

      const didInsert = await recordDonation(full);
      if (didInsert) inserted++;
      const amount = ((full.amount_total ?? 0) / 100).toFixed(2);
      console.log(
        `  ${didInsert ? "ADDED" : "have "}  ${s.id.slice(0, 22)}…  $${amount}  ` +
          `tier=${full.metadata?.tier ?? "-"}  ${new Date(full.created * 1000).toLocaleString()}`
      );
    }

    if (!batch.has_more) break;
    startingAfter = batch.data[batch.data.length - 1]?.id;
  }

  console.log(
    `\nscanned ${scanned} sessions, ${found} donations, ${inserted} newly recorded`
  );
}

main();

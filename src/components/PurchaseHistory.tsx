import { desc, eq } from "drizzle-orm";
import { db, creditPurchases } from "@/db";
import { stripe } from "@/lib/stripe";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Payment history, read from Stripe rather than reassembled from our tables.
 *
 * `charges.list` is one call that covers subscription payments and one-off pack
 * purchases alike, and it carries the receipt URL, refunded amounts and card
 * details we do not store. Stripe is the truth about what was actually charged;
 * a history built from our own rows would drift the first time a payment failed
 * or was refunded outside the app.
 *
 * Server component — the Stripe secret key never goes near the browser.
 */
export async function PurchaseHistory({
  userId,
  stripeCustomerId,
}: {
  userId: string;
  stripeCustomerId: string | null;
}) {
  const charges = stripeCustomerId
    ? (await stripe.charges.list({ customer: stripeCustomerId, limit: 100 })).data
    : [];

  // Our side of the ledger, so a credit balance can be reconciled against the
  // payments that bought it.
  const packs = await db
    .select()
    .from(creditPurchases)
    .where(eq(creditPurchases.userId, userId))
    .orderBy(desc(creditPurchases.createdAt));

  if (charges.length === 0 && packs.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <p className="text-sm text-slate-400">
          No purchases yet. A subscription or a pack of lookups will show up here with
          its receipt.
        </p>
      </div>
    );
  }

  const totalPaid = charges
    .filter((c) => c.status === "succeeded")
    .reduce((sum, c) => sum + c.amount - (c.amount_refunded ?? 0), 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-600">
        <span>
          Total paid{" "}
          <span className="font-semibold tabular-nums text-slate-300">{usd(totalPaid)}</span>
        </span>
        <span>
          Payments{" "}
          <span className="font-semibold tabular-nums text-slate-300">{charges.length}</span>
        </span>
      </div>

      {charges.length > 0 && (
        <ul className="space-y-2">
          {charges.map((c) => {
            const refunded = (c.amount_refunded ?? 0) > 0;
            const failed = c.status !== "succeeded";
            const card = c.payment_method_details?.card;

            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
              >
                <div className="min-w-[11rem] flex-1">
                  <p className="text-sm text-slate-200">{c.description ?? "Payment"}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {dateFmt.format(new Date(c.created * 1000))}
                    {card && (
                      <>
                        {" · "}
                        {card.brand?.toUpperCase()} ····{card.last4}
                      </>
                    )}
                  </p>
                </div>

                {(refunded || failed) && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${
                      failed
                        ? "bg-red-400/10 text-red-300 ring-red-400/25"
                        : "bg-amber-400/10 text-amber-300 ring-amber-400/25"
                    }`}
                  >
                    {failed
                      ? c.status
                      : c.amount_refunded === c.amount
                        ? "Refunded"
                        : "Partly refunded"}
                  </span>
                )}

                <span
                  className={`text-sm font-semibold tabular-nums ${
                    failed || refunded ? "text-slate-500 line-through" : "text-slate-100"
                  }`}
                >
                  {usd(c.amount)}
                </span>

                {c.receipt_url && (
                  <a
                    href={c.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-sky-400/40 hover:text-sky-300"
                  >
                    Receipt
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {packs.length > 0 && (
        <ul className="mt-3 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          {packs.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
            >
              <span className="text-slate-500">{dateFmt.format(p.createdAt)}</span>
              <span className="text-slate-300">
                <span className="font-semibold text-sky-300">+{p.credits}</span> lookups added
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        Receipts are hosted by Stripe. Tips made without signing in are not linked to an
        account and do not appear here.
      </p>
    </div>
  );
}

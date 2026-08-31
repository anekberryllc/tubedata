/**
 * TWO TIERS ONLY: Free and Pro.
 *
 * There was a middle "Plus" tier; it was removed on 2026-08-26 and folded into
 * Pro at the same $9/mo price. Do not reintroduce a third tier without also
 * revisiting lookup-packs.ts, whose pricing is set relative to the
 * subscription. Legacy `plan = 'paid'` rows were migrated to 'pro'.
 */
import { isAdmin } from "./roles";

export type Plan = "free" | "pro";

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
};

/** The single paid predicate. Everything paid is Pro — there is no tier above. */
export const isPro = (plan: Plan) => plan === "pro";

/**
 * Does this caller get the paid experience? ADMINS ALWAYS DO.
 *
 * Site powers imply full access — an admin who had to buy Pro to see what
 * they are moderating would be absurd. But their `plan` column is left on
 * 'free', deliberately:
 *
 *   - It is BILLING truth, owned by the Stripe webhook. Writing 'pro' into an
 *     admin's row invents a subscription that does not exist, and the next
 *     subscription event would overwrite it anyway.
 *   - The admin overview counts `plan = 'pro'` as paying subscribers. Faking
 *     it there would corrupt the one number that says whether this business
 *     works.
 *
 * So entitlement is DERIVED, here, and every gate asks this rather than
 * reading the column directly. Promoting someone to admin grants access the
 * moment their next request lands; demoting them takes it away just as fast.
 */
export function hasProAccess(
  sessionPlan?: string | null,
  sessionRole?: string | null
): boolean {
  return sessionPlan === "pro" || isAdmin(sessionRole);
}

/**
 * WHAT IS PAID, AS OF 2026-08-31
 *
 * The lookup itself is entirely free. Every field the API returns — tags,
 * topic categories, thumbnails, region restrictions, statistics history, raw
 * JSON — is shown to everyone, signed in or not. There is no gate on the
 * result card, which is why no applyPlanGate() exists any more.
 *
 * Pro buys two things:
 *   1. Lookup history (/history) — recorded for every signed-in user, but only
 *      viewable on Pro.
 *   2. Freedom from the daily lookup cap.
 *
 * AND THAT IS ALL. As of 2026-08-31 the estimated earnings range — our own
 * derived figure, and previously the one gated field — is free to everyone.
 * A lookup now returns everything it can, and what free buys is TEN OF THEM
 * A DAY. That is a cleaner promise than a partial result: someone evaluating
 * the product sees the whole thing and decides on volume, rather than being
 * shown a blurred box and asked to pay for something they cannot judge.
 *
 * So there is NO field-level gate left anywhere, fetched or derived. Do not
 * reintroduce one without deciding this question again — the only lever on
 * the result card is now how many times a day you may ask for it.
 *
 * Volume is limited by IP, in rate-limit.ts.
 */

/**
 * Resolve the caller's plan.
 *
 * `sessionPlan` comes from the signed-in user's row; undefined means signed out.
 * In development only, ?plan=pro previews the paid view without an account.
 *
 * Deliberately free of auth imports: src/auth.ts imports Plan from this file,
 * so importing auth back would be circular.
 *
 * NOTE: never use the result of this for rate limiting. The dev override would
 * become a bypass. Rate limiting reads the session plan directly.
 */
export function resolvePlan(
  searchParams: URLSearchParams,
  sessionPlan?: string,
  sessionRole?: string
): Plan {
  if (process.env.NODE_ENV !== "production") {
    if (searchParams.get("plan") === "pro") return "pro";
  }
  return hasProAccess(sessionPlan, sessionRole) ? "pro" : "free";
}

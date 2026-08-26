/**
 * TWO TIERS ONLY: Free and Pro.
 *
 * There was a middle "Plus" tier; it was removed on 2026-08-26 and folded into
 * Pro at the same $9/mo price. Do not reintroduce a third tier without also
 * revisiting lookup-packs.ts, whose pricing is set relative to the
 * subscription. Legacy `plan = 'paid'` rows were migrated to 'pro'.
 */
export type Plan = "free" | "pro";

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
};

/** The single paid predicate. Everything paid is Pro — there is no tier above. */
export const isPro = (plan: Plan) => plan === "pro";

/**
 * WHAT IS PAID, AS OF 2026-08-26
 *
 * The lookup itself is entirely free. Every field the API returns — tags,
 * topic categories, thumbnails, region restrictions, statistics history, raw
 * JSON — is shown to everyone, signed in or not. There is no gate on the
 * result card, which is why no applyPlanGate() exists any more.
 *
 * Pro buys three things instead:
 *   1. Lookup history (/history) — recorded for every signed-in user, but only
 *      viewable on Pro.
 *   2. Freedom from the daily lookup cap.
 *   3. Pro Tools — figures TubeData DERIVES rather than fetches. The estimated
 *      earnings range (lib/earnings.ts) is the first.
 *
 * The line to hold is between fetched and derived. Anything YouTube hands us
 * stays free to everyone, so do not reintroduce field-level stripping of the
 * result card. Our own model output is a different thing and may be gated —
 * use isPro() for all of it.
 *
 * Volume is limited separately, by IP, in rate-limit.ts.
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
export function resolvePlan(searchParams: URLSearchParams, sessionPlan?: string): Plan {
  if (process.env.NODE_ENV !== "production") {
    if (searchParams.get("plan") === "pro") return "pro";
  }
  return sessionPlan === "pro" ? "pro" : "free";
}

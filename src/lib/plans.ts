export type Plan = "free" | "paid" | "pro";

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  paid: "Plus",
  pro: "Pro",
};

export const isPremium = (plan: Plan) => plan !== "free";

/**
 * WHAT IS PAID, AS OF 2026-08-25
 *
 * The lookup itself is entirely free. Every field the API returns — tags,
 * topic categories, thumbnails, region restrictions, statistics history, raw
 * JSON — is shown to everyone, signed in or not. There is no gate on the
 * result card, which is why no applyPlanGate() exists any more.
 *
 * Paying buys two things instead:
 *   1. Lookup history (/history) — recorded for every signed-in user, but only
 *      viewable on Plus and above.
 *   2. Pro Tools — not built yet.
 *
 * Volume is limited separately, by IP, in rate-limit.ts. Use isPremium() to
 * gate anything new; do not reintroduce field-level stripping here.
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
    const p = searchParams.get("plan");
    if (p === "paid" || p === "pro") return p;
  }
  if (sessionPlan === "paid" || sessionPlan === "pro") return sessionPlan;
  return "free";
}

import { NextRequest, NextResponse } from "next/server";
import { lookupVideo } from "@/lib/video-service";
import { checkRateLimit, getClientIp, getLastLookupVideoId, DAILY_LIMIT } from "@/lib/rate-limit";
import { extractVideoId } from "@/lib/youtube";
import { resolvePlan, isPro } from "@/lib/plans";
import { estimateEarnings } from "@/lib/earnings";
import { auth } from "@/auth";
import { spendCredit, refundCredit, getCredits } from "@/lib/credits";

/**
 * Server-only: neither YOUTUBE_API_KEY nor DATABASE_URL reaches the browser.
 *
 * No field OBTAINED FROM YOUTUBE is gated by plan — tags, thumbnails, topics,
 * stats history and the raw JSON are all free to everyone, and that stays true.
 * What paying buys is lookup history, freedom from the daily cap, and Pro
 * Tools: figures TubeData derives itself, which are ours to sell. `earnings` is
 * the first of those, so it is computed here and withheld below Pro rather than
 * being sent and hidden in CSS.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ ok: false, message: "Missing ?url" }, { status: 400 });
  }

  const session = await auth();
  const ip = getClientIp(req.headers);

  // An immediate repeat of the same video is free: looking up URL1 twice in a
  // row, or refreshing the page, must not cost a second lookup. Only the LAST
  // lookup counts as the comparison, so URL1 → URL2 → URL1 is three lookups.
  const requestedVideoId = extractVideoId(url);
  const isRepeat =
    !!requestedVideoId && (await getLastLookupVideoId(ip)) === requestedVideoId;

  // The REAL account plan, not resolvePlan() — the dev ?plan= override must
  // never be able to lift the rate limit.
  const limit = await checkRateLimit(ip, session?.user?.plan);

  const rateHeaders: Record<string, string> = {
    "X-RateLimit-Limit": limit.unlimited ? "unlimited" : String(DAILY_LIMIT),
    "X-RateLimit-Remaining": limit.unlimited ? "unlimited" : String(limit.remaining ?? 0),
  };

  // Out of free lookups? Spend a prepaid credit before refusing. Credits are
  // deliberately consumed only here, so buying a pack never eats the free
  // daily allowance.
  let creditsRemaining: number | null = null;

  // A repeat costs nothing, so it must not be refused either — someone sitting
  // at 0 remaining can still refresh the result they already paid for.
  if (!limit.allowed && !isRepeat) {
    creditsRemaining = session?.user?.id ? await spendCredit(session.user.id) : null;

    if (creditsRemaining === null) {
      return NextResponse.json(
        {
          ok: false,
          reason: "rate_limited",
          message: `You have used all ${DAILY_LIMIT} free lookups for today. Buy a pack of lookups, subscribe to Pro for unlimited, or come back tomorrow.`,
          retryAfterSeconds: limit.retryAfterSeconds,
          rateLimit: { limit: DAILY_LIMIT, remaining: 0, unlimited: false },
          credits: 0,
        },
        {
          status: 429,
          headers: { ...rateHeaders, "Retry-After": String(limit.retryAfterSeconds) },
        }
      );
    }
  }

  const result = await lookupVideo(url, ip, session?.user?.id, !isRepeat);

  if (!result.ok) {
    // A credit was spent on a lookup that produced nothing usable — give it
    // back. Charging for a typo would be indefensible.
    if (creditsRemaining !== null && session?.user?.id) {
      creditsRemaining = await refundCredit(session.user.id);
    }
    const status = result.reason === "bad_url" ? 400 : result.reason === "api_error" ? 502 : 404;
    return NextResponse.json(
      { ...result, credits: creditsRemaining },
      { status, headers: rateHeaders }
    );
  }

  // `plan` labels the account, and now also decides one thing: whether the
  // earnings estimate is included.
  const plan = resolvePlan(req.nextUrl.searchParams, session?.user?.plan);

  // A prepaid lookup buys the Pro treatment FOR THAT LOOKUP. Someone who paid
  // for this one request should get everything the request can produce, not a
  // locked panel — they are paying more per lookup than a subscriber does.
  //
  // Deliberately per-request and not sticky: it grants nothing beyond this
  // response, and never touches `plan`. History stays a subscriber feature
  // because it is a property of the account, not of a single lookup.
  const spentCredit = creditsRemaining !== null;

  // resolvePlan's ?plan=pro dev override is fine to honour here, unlike in
  // rate limiting: the worst it can do in development is reveal a figure we
  // compute ourselves, and in production the override does not exist.
  const earnings =
    isPro(plan) || spentCredit ? estimateEarnings(result.data) : null;

  // Report what is left AFTER this request. A repeat consumed nothing, so the
  // counter must not move — that visible tick is the whole point of the rule.
  const remainingAfter = limit.unlimited
    ? null
    : Math.max(0, (limit.remaining ?? 0) - (isRepeat ? 0 : 1));

  return NextResponse.json(
    {
      ok: true,
      plan,
      data: { ...result.data, tagCount: result.data.tags.length },
      // null below Pro. The UI shows a locked panel on null rather than
      // guessing, so the gate lives in exactly one place.
      earnings,
      statsHistory: result.statsHistory,
      cacheHit: result.cacheHit,
      quotaUnits: result.quotaUnits,
      rateLimit: {
        limit: DAILY_LIMIT,
        remaining: remainingAfter,
        unlimited: limit.unlimited,
      },
      // Only a signed-in user has a balance worth reporting. When a credit was
      // just spent, spendCredit already returned the new figure.
      credits:
        creditsRemaining ??
        (session?.user?.id ? await getCredits(session.user.id) : null),
      // True when THIS lookup came out of the prepaid balance, so the UI can
      // say so rather than silently drawing down a purchase.
      spentCredit,
      // True when this was an immediate repeat and cost nothing.
      repeat: isRepeat,
    },
    {
      headers: {
        ...rateHeaders,
        "X-RateLimit-Remaining": limit.unlimited ? "unlimited" : String(remainingAfter ?? 0),
      },
    }
  );
}

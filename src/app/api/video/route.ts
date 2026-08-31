import { NextRequest, NextResponse } from "next/server";
import { lookupVideo } from "@/lib/video-service";
import { checkRateLimit, getClientIp, getLastLookupVideoId } from "@/lib/rate-limit";
import {
  FREE_DAILY_LOOKUPS,
  PRO_ALLOWANCE_LABEL,
  formatLookups,
} from "@/lib/limits";
import { extractVideoId } from "@/lib/youtube";
import { resolvePlan } from "@/lib/plans";
import { estimateEarnings } from "@/lib/earnings";
import { auth } from "@/auth";
import { blockedMessage } from "@/lib/roles";
import { spendCredit, refundCredit, getCredits } from "@/lib/credits";

/**
 * Server-only: neither YOUTUBE_API_KEY nor DATABASE_URL reaches the browser.
 *
 * NOTHING in the response is gated by plan any more — not the fields YouTube
 * returns, and not `earnings`, which TubeData derives itself and which used to
 * be Pro-only. A lookup returns everything it can to everyone; what paying
 * buys is lookup history and freedom from the daily cap. See lib/plans.ts.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ ok: false, message: "Missing ?url" }, { status: 400 });
  }

  const session = await auth();

  // A suspended account is refused before any quota, credit or cache is
  // touched. Checked here as well as in the layout because this route is
  // reachable directly — a blocked user who keeps their cookie and calls the
  // API with curl must hit the same wall as one who loads the page.
  if (session?.user?.blocked) {
    return NextResponse.json(
      {
        ok: false,
        reason: "blocked",
        message: blockedMessage(session.user.blockedReason),
      },
      { status: 403 }
    );
  }

  const ip = getClientIp(req.headers);

  // An immediate repeat of the same video is free: looking up URL1 twice in a
  // row, or refreshing the page, must not cost a second lookup. Only the LAST
  // lookup counts as the comparison, so URL1 → URL2 → URL1 is three lookups.
  const requestedVideoId = extractVideoId(url);
  const isRepeat =
    !!requestedVideoId && (await getLastLookupVideoId(ip)) === requestedVideoId;

  // The REAL account plan, not resolvePlan() — the dev ?plan= override must
  // never be able to lift the rate limit.
  const limit = await checkRateLimit({
    ip,
    plan: session?.user?.plan,
    role: session?.user?.role,
    // Pro is metered per ACCOUNT, so the allowance follows the person rather
    // than the network they happen to be on.
    userId: session?.user?.id,
  });

  const rateHeaders: Record<string, string> = {
    "X-RateLimit-Limit": limit.unlimited ? "unlimited" : String(limit.limit ?? FREE_DAILY_LOOKUPS),
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
          // A subscriber who runs out has nothing to upgrade TO, so they are
          // told about packs and the reset date instead of being sold Pro.
          message:
            limit.period === "month"
              ? `You have used all ${formatLookups(limit.limit ?? 0)} lookups included with Pro this month. Buy a pack of lookups to keep going — your monthly allowance resets on the 1st.`
              : `You have used all ${FREE_DAILY_LOOKUPS} free lookups for today. Buy a pack of lookups, subscribe to Pro for ${PRO_ALLOWANCE_LABEL}, or come back tomorrow.`,
          retryAfterSeconds: limit.retryAfterSeconds,
          rateLimit: {
            limit: limit.limit,
            remaining: 0,
            unlimited: false,
            period: limit.period,
          },
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

  // `plan` now only LABELS the account in the response. It no longer decides
  // what the response contains.
  const plan = resolvePlan(
    req.nextUrl.searchParams,
    session?.user?.plan,
    session?.user?.role
  );

  // True when THIS lookup came out of the prepaid balance. It used to also
  // unlock the earnings estimate for that one request; now that the estimate
  // is free to everyone it only tells the UI to say a credit was spent, rather
  // than silently drawing down a purchase.
  const spentCredit = creditsRemaining !== null;

  // Included for everyone, signed in or not. The daily allowance is what
  // limits a free visitor — ten complete lookups, not an unlimited number of
  // partial ones.
  const earnings = estimateEarnings(result.data);

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
      earnings,
      statsHistory: result.statsHistory,
      cacheHit: result.cacheHit,
      quotaUnits: result.quotaUnits,
      rateLimit: {
        limit: limit.limit,
        remaining: remainingAfter,
        unlimited: limit.unlimited,
        // The UI needs this to say "today" or "this month" — the same number
        // means different things to a free visitor and a subscriber.
        period: limit.period,
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

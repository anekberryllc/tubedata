import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { blockedMessage } from "@/lib/roles";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { fetchChannelWithPool } from "@/lib/youtube-pool";
import { computeChannelStats } from "@/lib/channel-stats";
import { auditChannel } from "@/lib/channel-audit";
import { getCredits, refundCredit, spendCredit } from "@/lib/credits";
import { FREE_DAILY_LOOKUPS, PRO_ALLOWANCE_LABEL, formatLookups } from "@/lib/limits";
import { db, lookups } from "@/db";

/**
 * Channel analysis.
 *
 * COUNTS AS ONE LOOKUP, THOUGH IT SPENDS THREE QUOTA UNITS. That is a decision,
 * not an oversight:
 *
 *   - "Lookups" is the unit the whole product is sold in — ten a day free,
 *     a thousand a month on Pro, packs priced per lookup. A channel silently
 *     costing three would make every number the site quotes wrong.
 *   - Three units against a 10,000/day key is negligible; the allowance exists
 *     to pace people, not to recover cost.
 *
 * If channel analysis ever becomes the dominant traffic, revisit this by
 * changing the charge here — NOT by quietly deducting more, which would make
 * the counter under the search box lie.
 *
 * Unlike the video route there is NO CACHE behind this. Channel statistics move
 * constantly and the interesting figures are all "as of now"; serving a
 * day-old subscriber count as if it were current is worse than spending a unit.
 */
export async function GET(req: NextRequest) {
  const input = (req.nextUrl.searchParams.get("q") ?? "").trim();

  if (!input) {
    return NextResponse.json(
      { ok: false, message: "Paste a channel URL or @handle." },
      { status: 400 }
    );
  }

  const session = await auth();

  if (session?.user?.blocked) {
    return NextResponse.json(
      { ok: false, reason: "blocked", message: blockedMessage(session.user.blockedReason) },
      { status: 403 }
    );
  }

  const ip = getClientIp(req.headers);
  const limit = await checkRateLimit({
    ip,
    plan: session?.user?.plan,
    role: session?.user?.role,
    // Pro is metered per ACCOUNT, so the allowance follows the person rather
    // than the network they happen to be on.
    userId: session?.user?.id,
  });

  let creditsRemaining: number | null = null;

  if (!limit.allowed) {
    // Same order as the video route: the prepaid balance is only reached once
    // the included allowance is gone, so a pack never wastes a free lookup.
    if (session?.user?.id) {
      creditsRemaining = await spendCredit(session.user.id);
    }

    if (creditsRemaining === null) {
      return NextResponse.json(
        {
          ok: false,
          reason: "rate_limited",
          // Same split as the video route: a subscriber who has run out has
          // nothing to upgrade TO, so they hear about packs and the reset date
          // rather than being sold Pro they already have.
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
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      );
    }
  }

  const result = await fetchChannelWithPool(input);

  if (!result.ok) {
    // Give the credit back. Charging someone for pasting the wrong URL, or for
    // our own key being exhausted, would be indefensible.
    if (creditsRemaining !== null && session?.user?.id) {
      creditsRemaining = await refundCredit(session.user.id);
    }

    const status =
      result.reason === "bad_url" || result.reason === "unsupported_url"
        ? 400
        : result.reason === "api_error"
          ? 502
          : 404;

    return NextResponse.json({ ...result, credits: creditsRemaining }, { status });
  }

  /**
   * RECORD THE LOOKUP. checkRateLimit counts rows in this table, so without
   * this insert the allowance never moves and channel analysis is unmetered —
   * free, unlimited, and invisible in the admin panel. The counter under the
   * search box would also keep showing a number that never went down.
   *
   * `videoId` is null because this is not a video; the column is nullable and
   * `sourceUrl` carries what was actually pasted. `quotaUnits` records the real
   * cost (three), because that table is where the admin panel reports quota
   * spend — the ONE lookup charged to the visitor and the THREE units spent by
   * us are different facts and both are worth keeping.
   */
  await db.insert(lookups).values({
    videoId: null,
    sourceUrl: input,
    cacheHit: false,
    quotaUnits: result.quotaUnits,
    ipAddress: ip,
    userId: session?.user?.id ?? null,
  });

  const stats = computeChannelStats(result.data.recent);

  const remainingAfter = limit.unlimited ? null : Math.max(0, (limit.remaining ?? 0) - 1);

  return NextResponse.json({
    ok: true,
    data: result.data,
    // Derived server-side so the page renders complete rather than computing
    // on arrival, and so both sides use the one implementation.
    stats,
    // Graded here rather than in the browser so the verdict and the numbers it
    // was reached from can never disagree.
    audit: auditChannel(result.data, stats),
    quotaUnits: result.quotaUnits,
    rateLimit: {
      limit: limit.limit,
      remaining: remainingAfter,
      unlimited: limit.unlimited,
      period: limit.period,
    },
    credits:
      creditsRemaining ?? (session?.user?.id ? await getCredits(session.user.id) : null),
    spentCredit: creditsRemaining !== null,
  });
}

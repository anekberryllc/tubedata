import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { blockedMessage } from "@/lib/roles";
import { getClientIp } from "@/lib/rate-limit";
import { suggestMany } from "@/lib/youtube-suggest";
import {
  buildVariants,
  dedupeTags,
  MAX_SEED_CHARS,
  type Tag,
} from "@/lib/tags";

/**
 * Tag suggestions for a topic.
 *
 * COSTS NO YOUTUBE QUOTA, which is why it does not touch checkRateLimit and
 * writes nothing to the `lookups` table. Spending a video lookup on a tool
 * that never calls the Data API would be charging for something free, and it
 * would corrupt the lookup counts the admin panel reports. This is open to
 * everyone, signed in or not.
 *
 * What it still needs is a throttle, because it makes requests to Google from
 * our server address: someone looping it could get that address rate-limited
 * and break the tool for everyone.
 */

/** Requests per IP per window. Generous — a person tries a handful of topics. */
const THROTTLE_MAX = 20;
const THROTTLE_WINDOW_MS = 60_000;

/**
 * In-memory, and therefore PER INSTANCE. On one Railway container that is the
 * whole picture; the day this runs on two, each gets its own allowance and the
 * effective limit doubles. Acceptable for a free tool that costs us nothing —
 * if it ever needs to be exact, it moves to the database like the lookup
 * limit, not to a bigger number here.
 */
const hits = new Map<string, number[]>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < THROTTLE_WINDOW_MS);

  if (recent.length >= THROTTLE_MAX) {
    // Write the pruned list back so the entry cannot grow without bound while
    // a caller keeps hitting the wall.
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);

  // Nothing else ever removes entries, so a long-lived process would hold one
  // array per IP it has ever seen. Cheap opportunistic sweep, run only when
  // the map is big enough to be worth it.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= THROTTLE_WINDOW_MS)) hits.delete(key);
    }
  }

  return false;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("q") ?? "";
  const seed = raw.trim().replace(/\s+/g, " ");

  if (!seed) {
    return NextResponse.json(
      { ok: false, message: "Enter a topic to generate tags for." },
      { status: 400 }
    );
  }

  if (seed.length > MAX_SEED_CHARS) {
    return NextResponse.json(
      {
        ok: false,
        message: `Keep the topic under ${MAX_SEED_CHARS} characters — a title or a subject, not a description.`,
      },
      { status: 400 }
    );
  }

  const session = await auth();

  // Consistent with every other route: a suspended account gets the same wall
  // here as on a page, even calling the API directly.
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

  if (throttled(getClientIp(req.headers))) {
    return NextResponse.json(
      { ok: false, message: "Too many generations in a row. Wait a minute and try again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  /**
   * Autocomplete is asked the same question five ways. The bare seed gives the
   * strongest demand signal; the four phrasings around it surface the long-tail
   * wording — "…for beginners", "how to…" — that a single query never returns.
   */
  const queries = [
    seed,
    `how to ${seed}`,
    `best ${seed}`,
    `${seed} tutorial`,
    `${seed} for beginners`,
  ];

  const results = await suggestMany(queries);
  const live = results.some((r) => r.length > 0);

  // ORDER IS SIGNIFICANCE ORDER, and the UI packs the 500-character budget by
  // taking from the front — so this ranking decides what someone actually ends
  // up pasting into YouTube.
  const candidates: Tag[] = [
    // The topic itself, always first: it is the one tag we know is on target.
    { text: seed, source: "seed" },
    // Real searches for the bare seed outrank everything derived.
    ...results[0].map((text) => ({ text, source: "suggest" as const })),
    // Then the long-tail phrasings, interleaved so no single modifier
    // monopolises the budget before the others get a look in.
    ...interleave(results.slice(1)).map((text) => ({ text, source: "suggest" as const })),
    // Algorithmic filler last — and the whole result when Google is unreachable.
    ...buildVariants(seed),
  ];

  return NextResponse.json({
    ok: true,
    seed,
    /**
     * False when every autocomplete call came back empty, which means these
     * are template variants rather than demand data. The UI says so rather
     * than passing guesses off as research.
     */
    live,
    tags: dedupeTags(candidates).slice(0, 48),
  });
}

/** Round-robin through several lists, so each contributes before any repeats. */
function interleave(lists: string[][]): string[] {
  const out: string[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));

  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]);
    }
  }

  return out;
}

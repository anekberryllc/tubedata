/**
 * YouTube search autocomplete — what people actually type into the search box.
 *
 * WHY THIS AND NOT THE DATA API. The official way to discover related phrasing
 * is `search.list`, which costs 100 quota units a call against a 10,000/day
 * budget: 100 tag generations would consume the entire day's quota and take
 * the video lookups — the actual product — down with them. This endpoint is
 * the one every keyword tool uses, costs nothing, and is not metered.
 *
 * THE TRADE, stated plainly: it is undocumented and unsupported. Google can
 * change or withdraw it without notice. That is survivable here and nowhere
 * else — a failure returns an empty array, the generator falls back to
 * lib/tags.ts variants, and the user still gets tags. Nothing in the paid
 * product may ever be built on this.
 *
 * `client=firefox` is the variant that answers with plain JSON. The other
 * clients wrap the same payload in a JSONP callback that would have to be
 * string-stripped before parsing.
 */

const ENDPOINT = "https://suggestqueries.google.com/complete/search";

/** Long enough for a slow round trip, short enough not to hang a request. */
const TIMEOUT_MS = 4000;

/**
 * Autocomplete for one query. Never throws: an unreachable or reshaped
 * endpoint is an empty result, not an error, because the caller has a
 * perfectly good offline fallback.
 */
export async function suggest(query: string): Promise<string[]> {
  const url = `${ENDPOINT}?${new URLSearchParams({
    client: "firefox",
    ds: "yt", // restrict to YouTube's index rather than web search
    q: query,
  })}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Suggestions for a topic are stable over a day and identical for every
      // visitor, so let Next cache them. Repeated generations for the same
      // seed then cost one round trip between us and Google, not one each.
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return [];

    // Shape: ["the query", ["suggestion", …], …]. Everything past index 1 is
    // metadata we do not use.
    const body: unknown = await res.json();
    if (!Array.isArray(body) || !Array.isArray(body[1])) return [];

    return body[1].filter((s): s is string => typeof s === "string");
  } catch {
    // Timeout, DNS, TLS, malformed JSON — all the same to the caller.
    return [];
  }
}

/**
 * Autocomplete for several queries at once.
 *
 * Fired in parallel: they are independent, and doing them in series would
 * stack five timeouts into a twenty-second request when the endpoint is down.
 * Results come back in the order the queries were given, which is the order
 * the caller ranks by.
 */
export async function suggestMany(queries: string[]): Promise<string[][]> {
  return Promise.all(queries.map(suggest));
}

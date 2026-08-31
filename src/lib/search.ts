import { or, sql, type SQL, type SQLWrapper } from "drizzle-orm";

/**
 * Text matching for every search box in the product.
 *
 * People do not type punctuation the way titles contain it. YouTube titles are
 * full of typographic apostrophes — "Don’t Trust Linus Tech Tips", "It
 * Shouldn’t be this Hard" — which nobody has on their keyboard, and nobody
 * remembers whether the channel was "LinusTechTips" or "Linus Tech Tips". So
 * both sides are stripped of punctuation and spacing before comparing:
 * "dont" finds "Don't", "linustech" finds "Linus Tech Tips".
 *
 * WHY AN EXPLICIT CHARACTER LIST, and not the obvious `[^[:alnum:]]`: that
 * class excludes Unicode combining marks, so it silently mangles Devanagari —
 * "कोर्टात" became "कोरटात" and the Marathi video in the database stopped being
 * findable at all. Deleting a known set of punctuation leaves every script's
 * letters, marks and digits alone, and — because the same string drives both
 * the SQL and the JavaScript — the two can never disagree about a character.
 *
 * The cost is that this cannot use an index: every row is normalized to answer
 * the query. That is the right trade at this size. If the lookups table grows
 * to where it hurts, the fix is a generated column with an index on it, using
 * this same expression — not a different notion of what a search means.
 */

/**
 * Characters removed from both the search term and the text being searched.
 * Includes the LIKE wildcards `%` and `_` and the escape `\`, which is why
 * nothing here needs separate wildcard escaping: a normalized term cannot
 * contain them.
 */
const STRIPPED =
  " \t\n'’‘`´\"“”.,!?:;-–—_/\\|()[]{}<>@#$%^&*+=~…";

/** Lowercase and drop everything in STRIPPED. The JS half of the rule. */
export function normalizeSearchTerm(term: string): string {
  let out = "";
  for (const ch of term.toLowerCase()) {
    if (!STRIPPED.includes(ch)) out += ch;
  }
  return out;
}

/**
 * A condition matching `term` against any of `columns`, loosely.
 *
 * Returns a `false` condition when the term normalizes to nothing — someone
 * searching "???" gets no results rather than every row, which is what an
 * unescaped wildcard would otherwise have produced.
 */
export function looseSearch(term: string, columns: SQLWrapper[]): SQL {
  const normalized = normalizeSearchTerm(term);
  if (!normalized) return sql`false`;

  const pattern = `%${normalized}%`;

  // STRIPPED is bound as a parameter rather than interpolated, so the set of
  // punctuation lives in exactly one place and never has to be SQL-escaped.
  const conditions = columns.map(
    (column) => sql`translate(lower(${column}), ${STRIPPED}, '') LIKE ${pattern}`
  );

  return conditions.length === 1 ? conditions[0] : (or(...conditions) as SQL);
}

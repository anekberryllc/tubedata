/**
 * Tag assembly — the pure half, shared by the generator API and its UI.
 *
 * DELIBERATELY FREE OF EVERY IMPORT. The character budget and the packing rule
 * have to agree exactly between the server that builds a tag list and the
 * browser that lets someone edit it; the only way to guarantee that is one
 * module both can load. Importing anything with a database or drizzle in its
 * tree would put it in the client bundle — the mistake that produced
 * "DATABASE_URL is not set" at runtime while tsc and next build both passed.
 * Nothing here may gain a dependency.
 */

/**
 * YouTube's cap on the whole `snippet.tags` property, in characters. Exceed it
 * and the upload is rejected — which is why the UI counts against it live
 * rather than letting someone copy 900 characters of tags and find out later.
 */
export const MAX_TAGS_CHARS = 500;

/**
 * Longest single tag we will suggest. Not YouTube's limit — a judgement that a
 * 60-character tag is a sentence, matches nothing, and only burns the budget
 * that useful tags need.
 */
export const MAX_TAG_CHARS = 60;

/** Seed length we accept. Past this it is a description, not a topic. */
export const MAX_SEED_CHARS = 120;

/**
 * How the budget is measured: the tags joined by commas, which is how they are
 * pasted into YouTube Studio and how YouTube stores them.
 */
export const tagsLength = (tags: string[]) => tags.join(",").length;

/**
 * Punctuation stripped when deciding whether two candidates are "the same
 * tag". "Drone Photography" and "drone-photography" are one suggestion, not
 * two, and offering both wastes a slot.
 *
 * An explicit list rather than a non-alphanumeric class, for the reason
 * lib/search.ts documents at length: `[^[:alnum:]]` drops Unicode combining
 * marks and silently mangles Devanagari. Same rule, restated here rather than
 * imported, because search.ts pulls in drizzle and this module must stay
 * loadable in the browser.
 */
const STRIPPED = " \t\n'’‘`´\"“”.,!?:;-–—_/\|()[]{}<>@#$%^&*+=~…";

/** The identity of a tag for de-duplication. Not shown to anyone. */
export function tagKey(tag: string): string {
  let out = "";
  for (const ch of tag.toLowerCase()) {
    if (!STRIPPED.includes(ch)) out += ch;
  }
  return out;
}

/** Where a suggestion came from. Shown as a chip hint, and used for ordering. */
export type TagSource = "seed" | "suggest" | "variant" | "word";

export type Tag = {
  text: string;
  source: TagSource;
};

/**
 * Collapse candidates to a unique, ordered list.
 *
 * Order is significance order and is decided by the CALLER — earlier wins, so
 * a tag that arrives first as a real autocomplete suggestion keeps that source
 * even if a later algorithmic variant happens to produce the same string.
 */
export function dedupeTags(candidates: Tag[]): Tag[] {
  const seen = new Set<string>();
  const out: Tag[] = [];

  for (const candidate of candidates) {
    const text = candidate.text.trim().replace(/\s+/g, " ");
    if (!text || text.length > MAX_TAG_CHARS) continue;

    const key = tagKey(text);
    // A candidate that is pure punctuation normalizes to nothing; it would
    // collide with every other such candidate and is worthless anyway.
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push({ ...candidate, text });
  }

  return out;
}

/**
 * Which tags fit inside the budget, taken in order until the next one would
 * not fit.
 *
 * Stops at the first tag that overflows rather than skipping it and trying the
 * ones after: the list is in significance order, so packing a later, shorter
 * tag ahead of an earlier one would quietly demote the better tag.
 */
export function packToBudget(tags: string[], budget = MAX_TAGS_CHARS): string[] {
  const packed: string[] = [];

  for (const tag of tags) {
    // +1 for the comma that joins it to what is already there.
    const cost = packed.length === 0 ? tag.length : tag.length + 1;
    if (tagsLength(packed) + cost > budget) break;
    packed.push(tag);
  }

  return packed;
}

/**
 * Modifiers that turn a topic into the phrasings people actually search.
 *
 * These are the filler, used to round out a thin result — the autocomplete
 * suggestions are real demand data and always rank above anything here.
 */
const SUFFIXES = [
  "tutorial",
  "for beginners",
  "tips",
  "guide",
  "explained",
  "step by step",
  "review",
  "ideas",
];

const PREFIXES = ["how to", "best", "easy"];

/** Words too common to be worth a tag of their own. */
const STOP_WORDS = new Set([
  "a", "an", "and", "the", "to", "of", "for", "in", "on", "with", "your",
  "my", "how", "what", "why", "is", "are", "vs", "or", "at", "by", "from",
]);

/**
 * Algorithmic candidates built from the seed alone — no network, so this is
 * also what the generator falls back to when autocomplete is unreachable.
 * A thin list beats an error page for someone who just wants tags.
 */
export function buildVariants(seed: string, year = new Date().getFullYear()): Tag[] {
  const base = seed.trim().replace(/\s+/g, " ");
  if (!base) return [];

  const out: Tag[] = [
    ...SUFFIXES.map((s) => ({ text: `${base} ${s}`, source: "variant" as const })),
    ...PREFIXES.map((p) => ({ text: `${p} ${base}`, source: "variant" as const })),
    { text: `${base} ${year}`, source: "variant" as const },
  ];

  // Individual words earn their place as the broad end of a tag set: a video
  // about "drone photography tips" should also carry "drone" and "photography".
  // Only worth doing when the seed is more than one word.
  const words = base.split(" ").filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));
  if (words.length > 1) {
    out.push(...words.map((w) => ({ text: w, source: "word" as const })));
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Hashtags
 *
 * A different property with a different failure mode, which is why they are
 * generated and budgeted separately rather than being the tag list with a "#"
 * glued on. Tags live in `snippet.tags` and are capped by CHARACTERS; hashtags
 * live in the description text and are capped by COUNT.
 * ------------------------------------------------------------------ */

/**
 * The cliff. YouTube ignores EVERY hashtag on a video that carries more than
 * fifteen of them — it does not keep the first fifteen and drop the rest, and
 * over-tagging is treated as spam. Overshooting here costs you the lot, so the
 * UI stops selection dead at this number instead of turning a counter red.
 */
export const MAX_HASHTAGS = 15;

/**
 * How many hashtags YouTube lifts out of the description and shows above the
 * video title. Only the first three, in description order — so the ORDER of a
 * hashtag set is a real decision, not cosmetic, and the UI shows which three
 * are the ones anybody will see.
 */
export const PROMINENT_HASHTAGS = 3;

/**
 * Longest hashtag body we will suggest, "#" excluded.
 *
 * The only filter that matters. An earlier version capped WORDS instead, which
 * looked sensible and was wrong: every useful hashtag for "drone photography
 * for beginners" is four words or more, so it threw away the entire set and
 * left four candidates for fifteen slots. Hashtags run together, so length is
 * the thing a reader actually feels — count the characters, not the words.
 */
const MAX_HASHTAG_CHARS = 30;

/**
 * A phrase as a hashtag: no spaces, no punctuation, lower case.
 *
 * This is `tagKey` with a "#" in front, and deliberately so — a hashtag IS the
 * normalized identity of a phrase, so the two cannot drift apart. It also
 * means hashtags inherit the Unicode handling documented on STRIPPED: letters
 * outside ASCII survive, which matters because YouTube accepts them.
 */
export const toHashtag = (text: string): string => `#${tagKey(text)}`;

/**
 * Words that carry nothing inside a hashtag but are not stop words for a TAG —
 * "how to do drone photography" is a fine tag, and #dodronephotography is not a
 * thing. Kept separate from STOP_WORDS so widening it here cannot change which
 * broad tags buildVariants emits.
 */
const HASHTAG_STOP = new Set(["do", "does", "did", "doing", "get", "really", "actually"]);

/**
 * Words that are fine INSIDE a hashtag and useless as one on their own:
 * #makesourdoughbread is a hashtag, #make is not. Checked only against
 * single-word candidates, so it never interferes with how a phrase compacts.
 */
const GENERIC_ALONE = new Set([
  "make", "making", "made", "try", "trying", "use", "using", "watch",
  "best", "easy", "new", "top", "good", "great", "full", "real",
]);

/** A phrase's words with the connecting ones dropped. */
function contentWords(text: string): string[] {
  return text.split(" ").filter((w) => {
    const lower = w.toLowerCase();
    return w && !STOP_WORDS.has(lower) && !HASHTAG_STOP.has(lower);
  });
}

/**
 * Hashtag candidates, ranked, from the same pool that produced the tags.
 *
 * Not the tag list with a "#" glued on. Each phrase is mined for the shorter
 * hashtags hiding inside it, because the one people actually search —
 * #dronephotography — appears in no tag on its own: it is the first two
 * content words of a four-word topic.
 *
 * Re-ranked too: a broad single word is one of the best hashtags you can have
 * and one of the weakest tags, so `word` is promoted above `variant` here even
 * though the tag ranking puts it last.
 */
export function buildHashtags(tags: Tag[]): Tag[] {
  /**
   * NOT the tag ranking. A broad single word is a weak tag and a strong
   * hashtag — #sourdough is how a video gets filed with every other sourdough
   * video, which is the entire job of a hashtag — so `word` outranks the
   * long-tail `suggest` phrases here. In the tag list it is the other way
   * round, and both are right for what they feed.
   */
  const RANK: Record<TagSource, number> = { seed: 0, word: 1, suggest: 2, variant: 3 };

  const ranked: { text: string; source: TagSource; rank: number; order: number }[] = [];
  const seen = new Set<string>();

  tags.forEach((tag, order) => {
    const words = contentWords(tag.text);

    const forms = [
      /**
       * Adjacent pairs — the sweet spot, and the only thing that produces
       * #dronephotography. ONLY from the seed. Mining pairs out of the
       * suggestions as well was tried and is worse than it looks: "real estate
       * drone photography" has "estate drone" adjacent inside it, and a set
       * built that way fills up with fragments that read like typos. The seed
       * is the one phrase whose internal word pairs are certain to be about
       * this video.
       */
      ...(tag.source === "seed"
        ? words.slice(0, -1).map((w, i) => `${w} ${words[i + 1]}`)
        : []),
      // The phrase with its connecting words dropped.
      words.join(" "),
      /**
       * And the phrase exactly as written — SEED ONLY, and only when nothing
       * in it is a HASHTAG_STOP word.
       *
       * Seed only because keeping both forms of every suggestion produces pairs
       * like #makesourdoughbreadvegan and #howtomakesourdoughbreadvegan, which
       * are the same hashtag spelled twice and burn two of fifteen slots to say
       * one thing. The topic itself is worth both spellings —
       * #howtomakesourdoughbread is a hashtag people genuinely follow — and
       * nothing else is.
       *
       * The stop-word check then catches "how to do drone photography", which
       * would otherwise give #howtododronephotography; its stripped form above
       * already covers that phrase.
       */
      ...(tag.source === "seed" &&
      !tag.text.split(" ").some((w) => HASHTAG_STOP.has(w.toLowerCase()))
        ? [tag.text]
        : []),
    ];

    // Shortest first within a phrase, so the tightest hashtag a topic yields
    // is also the one most likely to land in the three shown above the title.
    const bodies = forms
      .filter((form) => {
        const parts = form.trim().split(" ");
        return parts.length > 1 || !GENERIC_ALONE.has(parts[0].toLowerCase());
      })
      .map(tagKey)
      .filter((body) => body.length > 1 && body.length <= MAX_HASHTAG_CHARS)
      .sort((a, b) => a.length - b.length);

    for (const body of bodies) {
      if (seen.has(body)) continue;
      seen.add(body);
      ranked.push({ text: `#${body}`, source: tag.source, rank: RANK[tag.source], order });
    }
  });

  return (
    ranked
      // Stable within a rank, so the significance order the caller chose still
      // decides everything except which source wins.
      .sort((a, b) => a.rank - b.rank || a.order - b.order)
      .map(({ text, source }) => ({ text, source }))
      // More than can be used, on purpose: fifteen slots out of a couple of
      // dozen candidates is a choice, which is the whole point of the tool.
      .slice(0, 24)
  );
}

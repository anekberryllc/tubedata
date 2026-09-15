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

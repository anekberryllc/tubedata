"use client";

import { useState } from "react";
import { CopyButton } from "./CopyButton";
import {
  MAX_HASHTAGS,
  MAX_SEED_CHARS,
  MAX_TAGS_CHARS,
  PROMINENT_HASHTAGS,
  packToBudget,
  tagsLength,
  type Tag,
} from "@/lib/tags";

/**
 * Tag generator.
 *
 * The output is a SELECTION, not a list. Every generator that just prints
 * forty tags leaves the real work — deciding which ones fit YouTube's
 * 500-character property and which are off-topic — to the person pasting
 * them. Here the budget is spent visibly: the best tags arrive pre-selected up
 * to the limit, and every toggle moves the counter.
 */

type Result = {
  seed: string;
  /** False when autocomplete was unreachable and these are template variants. */
  live: boolean;
  tags: Tag[];
  hashtags: Tag[];
};

/** Chip hint per source. `suggest` is the one worth bragging about. */
const SOURCE_LABEL: Record<Tag["source"], string> = {
  seed: "your topic",
  suggest: "searched on YouTube",
  variant: "common phrasing",
  word: "broad term",
};

export function TagGenerator() {
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hashSelected, setHashSelected] = useState<Set<string>>(new Set());

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    const q = seed.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tags?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.message ?? "Could not generate tags. Try again.");
        setResult(null);
        return;
      }

      setResult(data);
      // Pre-select as many as the budget holds, in the order the server ranked
      // them. Set here rather than in an effect so there is never a frame with
      // results on screen and nothing selected.
      setSelected(new Set(packToBudget(data.tags.map((t: Tag) => t.text))));
      // Hashtags are capped by count, not characters, so the opening selection
      // is simply the strongest fifteen.
      setHashSelected(
        new Set(data.hashtags.slice(0, MAX_HASHTAGS).map((t: Tag) => t.text))
      );
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function toggle(text: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  }

  /**
   * The count cap is enforced HERE rather than reported afterwards. Fifteen is
   * a cliff, not a budget: a sixteenth hashtag does not cost you the sixteenth,
   * it costs you all of them. Nothing in this UI can put someone over it.
   */
  function toggleHashtag(text: string) {
    setHashSelected((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else if (next.size < MAX_HASHTAGS) next.add(text);
      return next;
    });
  }

  // Selection order follows the RANKING, not the order things were clicked —
  // so what gets copied is stable and puts the strongest tags first.
  const chosen = (result?.tags ?? []).filter((t) => selected.has(t.text)).map((t) => t.text);

  // Same rule for hashtags, and it carries more weight here: description order
  // is what decides which three YouTube lifts above the title.
  const chosenHashtags = (result?.hashtags ?? [])
    .filter((t) => hashSelected.has(t.text))
    .map((t) => t.text);
  const hashFull = chosenHashtags.length >= MAX_HASHTAGS;

  const used = tagsLength(chosen);
  const over = used > MAX_TAGS_CHARS;
  const percent = Math.min(100, Math.round((used / MAX_TAGS_CHARS) * 100));

  return (
    <>
      <form onSubmit={generate} className="mt-10">
        <div className="group relative rounded-2xl bg-gradient-to-r from-sky-500/25 via-indigo-500/25 to-fuchsia-500/25 p-px transition focus-within:from-sky-400/60 focus-within:via-indigo-400/60 focus-within:to-fuchsia-400/60">
          <div className="flex items-center gap-2 rounded-2xl bg-[#0a0e18] p-2">
            <input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              maxLength={MAX_SEED_CHARS}
              placeholder="drone photography for beginners"
              aria-label="Video topic or title"
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !seed.trim()}
              className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-40"
            >
              {loading ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>

        <p className="mt-3 px-1 text-xs text-slate-600">
          Describe the video in a few words — the subject, not the whole description.
        </p>
      </form>

      {error && (
        <div className="animate-rise mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="animate-rise mt-8">
          {/* ---------- BUDGET ---------- */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {chosen.length} tag{chosen.length === 1 ? "" : "s"} selected
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  <span className={over ? "text-red-300" : "text-slate-400"}>{used}</span> of{" "}
                  {MAX_TAGS_CHARS} characters
                  {over && " — YouTube will reject this"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelected(new Set(packToBudget(result.tags.map((t) => t.text))))
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:border-white/25 hover:text-white"
                >
                  Fill to limit
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:border-white/25 hover:text-white"
                >
                  Clear
                </button>
                {/* A getter, so the value is read at click time rather than
                    captured on every toggle. Comma-space is what YouTube
                    Studio's tag box expects on paste. */}
                <CopyButton
                  text={() => chosen.join(", ")}
                  label="Copy tags"
                  copiedLabel="Copied"
                  title="Copy the selected tags, comma separated"
                />
              </div>
            </div>

            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full transition-all ${
                  over ? "bg-red-400" : "bg-gradient-to-r from-sky-400 to-indigo-400"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* ---------- SUGGESTIONS ---------- */}
          <div className="mt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-slate-200">
                Tags for &ldquo;{result.seed}&rdquo;
              </h2>
              <p className="text-xs text-slate-600">Click a tag to add or remove it</p>
            </div>

            {/* Honesty about the source. Without autocomplete these are just
                templates around the topic, and saying so is the difference
                between a tool and a guess dressed as research. */}
            {!result.live && (
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-200">
                YouTube&rsquo;s suggestion service did not respond, so these are common
                phrasings built from your topic rather than real searches. Try again in a
                moment for search-based tags.
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {result.tags.map((tag) => {
                const on = selected.has(tag.text);
                return (
                  <button
                    key={tag.text}
                    type="button"
                    onClick={() => toggle(tag.text)}
                    aria-pressed={on}
                    title={SOURCE_LABEL[tag.source]}
                    className={`rounded-lg px-2.5 py-1 text-xs ring-1 transition ${
                      on
                        ? "bg-sky-400/[0.08] text-sky-200 ring-sky-400/15 hover:bg-sky-400/[0.14]"
                        : "bg-white/[0.02] text-slate-500 ring-white/[0.07] hover:text-slate-300 hover:ring-white/20"
                    }`}
                  >
                    {/* Marks which tags came from real YouTube searches, so the
                        demand-backed ones are distinguishable at a glance. */}
                    {tag.source === "suggest" && (
                      <span aria-hidden="true" className="mr-1 text-[9px] text-sky-400/70">
                        ◆
                      </span>
                    )}
                    {tag.text}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              <span aria-hidden="true" className="text-sky-400/70">
                ◆
              </span>{" "}
              marks phrases people actually search for on YouTube. The rest are common
              phrasings and broad terms built from your topic.
            </p>
          </div>

          {/* ---------- HASHTAGS ---------- */}
          <div className="mt-10 border-t border-white/[0.07] pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-slate-200">
                Hashtags for &ldquo;{result.seed}&rdquo;
              </h2>
              <p className="text-xs text-slate-600">
                For the description — not the tag box
              </p>
            </div>

            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {chosenHashtags.length} of {MAX_HASHTAGS} hashtags
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {hashFull
                      ? "At the limit — past 15, YouTube ignores every hashtag on the video"
                      : "Stay at or under 15, or YouTube ignores all of them"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setHashSelected(
                        new Set(result.hashtags.slice(0, MAX_HASHTAGS).map((t) => t.text))
                      )
                    }
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:border-white/25 hover:text-white"
                  >
                    Fill to {MAX_HASHTAGS}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHashSelected(new Set())}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:border-white/25 hover:text-white"
                  >
                    Clear
                  </button>
                  {/* Space separated, because these get pasted into the
                      description as a line of text, not into a tag field. */}
                  <CopyButton
                    text={() => chosenHashtags.join(" ")}
                    label="Copy hashtags"
                    copiedLabel="Copied"
                    title="Copy the selected hashtags, space separated"
                  />
                </div>
              </div>

              {/* The three that actually get seen. Ordering hashtags is a real
                  decision and invisible everywhere else, so it is shown. */}
              {chosenHashtags.length > 0 && (
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">
                    Shown above your title
                  </p>
                  <p className="mt-1 truncate text-sm text-sky-300">
                    {chosenHashtags.slice(0, PROMINENT_HASHTAGS).join(" ")}
                  </p>
                  {chosenHashtags.length > PROMINENT_HASHTAGS && (
                    <p className="mt-1 text-[11px] text-slate-600">
                      The other {chosenHashtags.length - PROMINENT_HASHTAGS}
                      {chosenHashtags.length - PROMINENT_HASHTAGS === 1 ? " sits" : " sit"} in
                      the description, where they still count for search.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {result.hashtags.map((tag) => {
                const on = hashSelected.has(tag.text);
                // Disabled rather than silently ignored, so the cap explains
                // itself before the click instead of after it.
                const locked = !on && hashFull;
                return (
                  <button
                    key={tag.text}
                    type="button"
                    onClick={() => toggleHashtag(tag.text)}
                    aria-pressed={on}
                    disabled={locked}
                    title={
                      locked
                        ? `Deselect one first — ${MAX_HASHTAGS} is YouTube's limit`
                        : SOURCE_LABEL[tag.source]
                    }
                    className={`rounded-lg px-2.5 py-1 text-xs ring-1 transition ${
                      on
                        ? "bg-indigo-400/[0.10] text-indigo-200 ring-indigo-400/20 hover:bg-indigo-400/[0.16]"
                        : locked
                          ? "cursor-not-allowed bg-white/[0.01] text-slate-700 ring-white/[0.04]"
                          : "bg-white/[0.02] text-slate-500 ring-white/[0.07] hover:text-slate-300 hover:ring-white/20"
                    }`}
                  >
                    {tag.text}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              Paste these at the end of your description. The first three appear above
              your title; all of them help YouTube place the video alongside the ones
              already using the same hashtags.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

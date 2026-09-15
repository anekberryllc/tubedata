import type { Metadata } from "next";
import Link from "next/link";
import { ArticleShell, Callout, H2, JsonLd, Key, Prose } from "../Article";
import { MAX_HASHTAGS, PROMINENT_HASHTAGS } from "@/lib/tags";

const UPDATED = "15 September 2026";

export const metadata: Metadata = {
  title: "YouTube Hashtags — The 15 Limit and the 3 That Show Above Your Title",
  description:
    `Use more than ${MAX_HASHTAGS} hashtags and YouTube ignores all of them. Only the ` +
    `first ${PROMINENT_HASHTAGS} appear above your title. How the limits actually ` +
    "work, and how hashtags differ from tags.",
  alternates: { canonical: "/guides/youtube-hashtags" },
};

/**
 * The limits here are read from lib/tags.ts rather than typed into the prose,
 * so the article cannot contradict the tool that enforces them. If YouTube
 * changes the cap, one constant moves and both follow.
 */
export default function Page() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How many hashtags can you use on YouTube?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  `${MAX_HASHTAGS}. Going over does not simply drop the extras — ` +
                  "YouTube ignores every hashtag on the video, and over-tagging can be " +
                  "treated as spam.",
              },
            },
            {
              "@type": "Question",
              name: "Which YouTube hashtags show above the title?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  `The first ${PROMINENT_HASHTAGS} in your description, in the order ` +
                  "you wrote them. The rest still count for search but are only visible " +
                  "inside the description.",
              },
            },
            {
              "@type": "Question",
              name: "Are YouTube hashtags the same as tags?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "No. Hashtags are visible, carry a # and cannot contain spaces. Tags " +
                  "are invisible to viewers, carry no # and can be whole phrases.",
              },
            },
          ],
        }}
      />

      <ArticleShell
        title="YouTube hashtags: the 15 limit, and the 3 that actually get seen"
        standfirst="Hashtags have two hard rules that most advice gets wrong. One of them silently deletes all your work if you cross it."
        updated={UPDATED}
      >
        <Prose>
          <p>
            A hashtag is a word prefixed with <code>#</code>, written in your video
            description. Clicking one opens a feed of other videos using the same tag,
            which is the whole mechanism: hashtags group your video with others rather
            than describing it.
          </p>

          <H2>Rule one: {MAX_HASHTAGS} is a cliff, not a budget</H2>
          <p>
            You may use up to <Key>{MAX_HASHTAGS} hashtags</Key>. Go over and YouTube
            does not keep the first {MAX_HASHTAGS} and drop the rest — it{" "}
            <Key>ignores every hashtag on the video</Key>. Excessive tagging can also be
            treated as spam under YouTube&rsquo;s policies.
          </p>

          <Callout>
            This is the difference that matters. Exceeding the tag character limit costs
            you the overflow. Exceeding the hashtag count costs you <em>all</em> of them,
            silently, with nothing in Studio telling you it happened.
          </Callout>

          <p>
            The practical consequence: never treat {MAX_HASHTAGS} as a target to fill.
            Six good hashtags beat sixteen, and sixteen is worth nothing at all.
          </p>

          <H2>Rule two: only the first {PROMINENT_HASHTAGS} are visible</H2>
          <p>
            YouTube lifts the <Key>first {PROMINENT_HASHTAGS} hashtags</Key> from your
            description and displays them above the video title, as links. That is where
            almost all hashtag clicks come from.
          </p>
          <p>
            They are taken in description order — so the order you write them in is a
            real decision, not cosmetic. The rest still count for search and still place
            you in those feeds; they are just invisible unless someone expands the
            description.
          </p>
          <p>
            One exception worth knowing: if you put a hashtag in the video{" "}
            <em>title</em>, that takes over the space above the title and the description
            ones stop showing there.
          </p>

          <H2>Hashtags vs tags</H2>
          <p>
            They are different systems and neither replaces the other.
          </p>
          <p>
            <Key>Hashtags</Key> are visible, clickable, carry a <code>#</code>, and
            cannot contain spaces — <code>#dronephotography</code>, not{" "}
            <code>#drone photography</code>, which breaks at the space.
          </p>
          <p>
            <Key>Tags</Key> are invisible to viewers, carry no <code>#</code>, and can be
            whole phrases with spaces.{" "}
            <Link
              href="/guides/youtube-video-tags"
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              They work quite differently
            </Link>{" "}
            and are worth reading about separately.
          </p>

          <H2>Choosing them</H2>
          <p>
            Because only {PROMINENT_HASHTAGS} are seen and {MAX_HASHTAGS} is a ceiling
            you should not approach, hashtag choice is mostly about restraint. A workable
            shape:
          </p>
          <p>
            Lead with the <Key>specific</Key> one — the phrase that describes this video
            and would put it among genuinely similar ones. Follow with a{" "}
            <Key>broad</Key> one that has real volume, which is how you land in a busy
            feed at all. Then stop somewhere well short of the limit.
          </p>
          <p>
            A hashtag nobody else uses is a feed of one. A hashtag everybody uses is a
            feed you vanish into. The useful ones are in between, and finding them is
            worth more than adding more.
          </p>
        </Prose>
      </ArticleShell>
    </>
  );
}

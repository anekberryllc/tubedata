import type { Metadata } from "next";
import Link from "next/link";
import { ArticleShell, Callout, H2, JsonLd, Key, Prose } from "../Article";
import { MAX_TAGS_CHARS } from "@/lib/tags";

const TITLE = "YouTube video tags: how to see them, and what they're worth";
const UPDATED = "15 September 2026";

export const metadata: Metadata = {
  title: "YouTube Video Tags — How to See Them and What They're Worth",
  description:
    "Tags are invisible on the watch page but public in YouTube's API. What they are, " +
    "how to read any video's tags, how they differ from hashtags and from channel " +
    "keywords, and an honest answer on whether they affect ranking.",
  alternates: { canonical: "/guides/youtube-video-tags" },
};

/**
 * The flagship guide, and the one page on this site aimed squarely at people
 * searching for how to extract tags from a video.
 *
 * It answers the question fully IN THE TEXT rather than teasing the tool. A page
 * that withholds the answer to make you click is the kind search engines have
 * spent a decade learning to demote, and it is also just worse.
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
              name: "Can you see the tags on a YouTube video?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "Not on the watch page — tags are invisible to viewers. They are " +
                  "public in YouTube's Data API, which is how tools read them. Any " +
                  "video that is public returns its tags.",
              },
            },
            {
              "@type": "Question",
              name: "What is the YouTube tag character limit?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  `YouTube caps the whole tag field at ${MAX_TAGS_CHARS} characters, ` +
                  "counted across every tag joined together, not per tag.",
              },
            },
            {
              "@type": "Question",
              name: "Do YouTube tags affect ranking?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "YouTube has said tags play a minimal role, mainly helping with " +
                  "misspellings. Title, thumbnail, description and watch time matter " +
                  "far more. Tags are cheap to get right, but they are not a ranking " +
                  "lever on their own.",
              },
            },
          ],
        }}
      />

      <ArticleShell
        title={TITLE}
        standfirst="Tags are the only part of a YouTube video's metadata that the uploader writes and nobody else can see. That makes them genuinely useful to read — and widely oversold as a ranking trick."
        updated={UPDATED}
      >
        <Prose>
          <p>
            A tag is a keyword a creator attaches when uploading, to tell YouTube what
            the video is about. They never appear on the watch page. They are not in the
            description, not under the title, and not anywhere a viewer can click.
          </p>
          <p>
            They are, however, <Key>public data</Key>. YouTube returns them through its
            Data API for every public video, which is how any tool that shows you a
            video&rsquo;s tags works — including this one. Nothing is being scraped or
            unlocked; the field is simply not rendered on youtube.com.
          </p>

          <Callout>
            The gap between &ldquo;invisible&rdquo; and &ldquo;private&rdquo; is the
            whole reason tag research exists as a product category. Tags are hidden from
            viewers and freely available to software.
          </Callout>

          <H2>Tags are not hashtags</H2>
          <p>
            These get conflated constantly, and they behave nothing alike.
          </p>
          <p>
            <Key>Hashtags</Key> are visible. They carry a <code>#</code>, live in the
            description, and the first three appear above the video title. They are a
            navigation feature — clicking one takes you to a feed of other videos using
            it.
          </p>
          <p>
            <Key>Tags</Key> are invisible, carry no <code>#</code>, and can contain
            spaces — so a single tag can be an entire phrase like{" "}
            <em>drone photography for beginners</em>. They are a labelling feature, read
            by YouTube and nobody else.
          </p>
          <p>
            One consequence worth knowing: because tags are hidden, they are the right
            place for things you would never put in a title. Misspellings of your brand,
            slang, abbreviations people actually type. YouTube itself suggests this.
            Nobody sees them, so nothing is lost to awkwardness.{" "}
            <Link
              href="/guides/youtube-hashtags"
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              Hashtags work differently
            </Link>{" "}
            and have their own hard limits.
          </p>

          <H2>Channel keywords: the same idea, one level up</H2>
          <p>
            Tags describe one video. A channel also has its own set of keywords, set once
            in YouTube Studio under Settings → Channel → Basic info, and they are{" "}
            <Key>equally invisible</Key> — nothing on the channel page shows them.
          </p>
          <p>
            They are public through the API in exactly the same way, and almost no tool
            surfaces them, which makes them one of the more useful things to read off a
            competitor. They tell you how a channel describes itself as a whole, rather
            than how it described one upload.
          </p>
          <p>
            One quirk worth knowing if you ever read them raw: YouTube stores them as a
            single space-separated string, with quotation marks around any keyword that
            contains a space — <code>baking &ldquo;sourdough bread&rdquo; recipes</code>.
            Split that on spaces and you get four broken fragments instead of three
            keywords, which is why some tools display channel keywords as nonsense.
          </p>
          <p>
            Our{" "}
            <Link
              href="/tools/channel-analyzer"
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              channel audit
            </Link>{" "}
            reads them, and flags a channel that has none — it is one of the more common
            things to find missing.
          </p>

          <H2>How to see any video&rsquo;s tags</H2>
          <p>
            Three ways, in descending order of sanity:
          </p>
          <p>
            <Key>Use a lookup tool.</Key> Paste the URL, read the tags. This is what
            TubeData&rsquo;s home page does, and it returns them in the uploader&rsquo;s
            original order — which matters, see below.
          </p>
          <p>
            <Key>View the page source.</Key> Open a video, view source, and search for{" "}
            <code>keywords</code>. The tags are in a meta tag. This works, costs nothing,
            and is miserable for more than one video.
          </p>
          <p>
            <Key>Call the API yourself.</Key> A <code>videos.list</code> request with the{" "}
            <code>snippet</code> part returns <code>snippet.tags</code>. Worth knowing if
            you are building something; overkill if you want to check one competitor.
          </p>

          <H2>Why the order is the interesting part</H2>
          <p>
            Tags come back in the order the creator typed them, and most people write
            them the same way: brand first, then broad category terms, then niche
            phrases. Reading top to bottom shows you what they think the video is
            actually about, and which terms they prioritised over others.
          </p>
          <p>
            That ordering is a genuine signal about a competitor&rsquo;s thinking, and it
            is lost entirely by any tool that alphabetises the list.
          </p>

          <H2>What to do with a competitor&rsquo;s tags</H2>
          <p>
            <Key>If they have none</Key> — which is common, because the field sits behind
            &ldquo;Show more&rdquo; in YouTube Studio and plenty of uploaders never open
            it — that is good news. Anything you add puts you ahead. Take your cues from
            their title, description and hashtags instead.
          </p>
          <p>
            <Key>If they have tags</Key>, judge the quality before copying. Match their
            broad terms to stay in the same conversation, then add the niche ones they
            missed. Copying a tag list wholesale just makes you the worse version of a
            video that already exists.
          </p>

          <H2>Writing your own</H2>
          <p>
            You get <Key>{MAX_TAGS_CHARS} characters in total</Key> — counted across all
            your tags joined together, not per tag. Most people use nowhere near it.
            Exceed it and YouTube rejects the upload, which is why a tag tool worth using
            counts against that budget as you select.
          </p>
          <p>
            Tags can be edited after publishing. A video that underperformed is worth
            revisiting rather than writing off.
          </p>

          <H2>Do tags affect ranking? Honestly:</H2>
          <p>
            Far less than the people selling tag tools imply. YouTube has publicly said
            tags play a minimal role and mainly help when viewers misspell things. Title,
            thumbnail, description and watch time all matter more — and it is not close.
          </p>
          <p>
            The honest case for tags is smaller and still real: they are cheap, they take
            two minutes, they cost nothing to get right, and the more accurate signals
            YouTube has about your video, the better its chances of being matched to the
            right viewer. That is worth doing. It is not a growth strategy.
          </p>
          <p>
            Anyone quoting you a percentage for how much tags affect ranking is guessing.
            Nobody outside YouTube knows.
          </p>
        </Prose>
      </ArticleShell>
    </>
  );
}

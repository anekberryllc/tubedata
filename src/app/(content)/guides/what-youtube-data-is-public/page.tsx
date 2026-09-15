import type { Metadata } from "next";
import Link from "next/link";
import { ArticleShell, Callout, H2, JsonLd, Key, Prose } from "../Article";

const UPDATED = "15 September 2026";

export const metadata: Metadata = {
  title: "What YouTube Data Is Public — and What No Tool Can Show You",
  description:
    "Tags, channel keywords, topic categories and paid-promotion flags are public. " +
    "Dislikes, revenue, watch time, member counts and captions are not — and no tool " +
    "can show them, whatever it claims. What the YouTube API returns at video and " +
    "channel level, tested.",
  alternates: { canonical: "/guides/what-youtube-data-is-public" },
};

/**
 * The most defensible page on the site, because it is the only one that could
 * not have been written without doing the work. Every limit below was hit while
 * building TubeData — the 401s, the OAuth walls, the fields that turn out to be
 * owner-only. Competitors can copy a tags explainer from anyone; they cannot
 * copy this without spending the same weeks against the API.
 *
 * It is also the page that makes the product trustworthy: a tool that tells you
 * what it CANNOT do is more believable about what it can.
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
              name: "Can any tool show YouTube dislikes?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "No. YouTube removed dislike counts from the public API in December " +
                  "2021. Tools that display a number are estimating it from other " +
                  "signals or from archived pre-2021 data, not reading it.",
              },
            },
            {
              "@type": "Question",
              name: "Can you see how much money a YouTube video made?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "No. Only the channel owner sees revenue, in YouTube Studio. Every " +
                  "public figure is an estimate from views multiplied by an assumed " +
                  "RPM, and cannot know whether the channel is monetised at all.",
              },
            },
            {
              "@type": "Question",
              name: "Are YouTube subscriber counts exact?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "No. YouTube rounds public subscriber counts to three significant " +
                  "figures, so a channel shown as 21.3M could be anywhere across a range " +
                  "tens of thousands wide. Only the channel owner sees the exact number.",
              },
            },
            {
              "@type": "Question",
              name: "Can you download a YouTube video's captions?",
              acceptedAnswer: {
                "@type": "Answer",
                text:
                  "Not through the API without permission. Listing and downloading " +
                  "captions both require OAuth authorisation from the channel that " +
                  "owns the video.",
              },
            },
          ],
        }}
      />

      <ArticleShell
        title="What YouTube data is public — and what no tool can show you"
        standfirst="Some of the most-requested YouTube numbers simply do not exist outside Studio. Here is the line between what is genuinely available and what is being estimated at you."
        updated={UPDATED}
      >
        <Prose>
          <p>
            Every YouTube analytics tool draws from the same public API. That means the
            interesting question is not which tool has more data — none of them do — but
            where the wall is. This is where, tested rather than assumed.
          </p>

          <H2>Public, and more than people expect</H2>
          <p>
            <Key>Tags.</Key> Invisible on the watch page, returned in full for every
            public video.{" "}
            <Link
              href="/guides/youtube-video-tags"
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              Covered separately
            </Link>
            .
          </p>
          <p>
            <Key>Topic categories.</Key> Subject classifications Google assigns
            automatically, linked to Wikipedia categories. The uploader does not choose
            them and cannot see them — they are derived from the content and used to
            shape recommendations.
          </p>
          <p>
            <Key>Every thumbnail size.</Key> YouTube generates a set from 120px up to
            1280×720. The one in search results is a single member of it; the rest are
            all directly reachable.
          </p>
          <p>
            <Key>Paid promotion.</Key> Whether the uploader declared the video contains
            paid product placement is public. It is the only non-ad monetisation signal
            YouTube exposes about a video, and almost nothing surfaces it.
          </p>
          <p>
            <Key>Technical flags.</Key> Whether captions exist, definition, licensing,
            whether it is made for kids, embeddability, region restrictions.
          </p>

          <H2>At channel level</H2>
          <p>
            Most of this article is about a single video, but a channel publishes its own
            record, and some of it surprises people.
          </p>
          <p>
            <Key>Channel keywords.</Key> The channel-level equivalent of video tags,
            hidden from viewers in exactly the same way and public through the API in
            exactly the same way. Barely any tool shows them.
          </p>
          <p>
            <Key>Totals, country and creation date.</Key> Subscriber count, lifetime
            views, public video count, the country the channel declares, and the day it
            was created.
          </p>
          <p>
            <Key>Topic categories.</Key> Assigned by Google, same as for videos, and not
            chosen by the owner.
          </p>
          <p>
            <Key>The full upload list, cheaply.</Key> Every channel has an automatically
            maintained &ldquo;uploads&rdquo; playlist. Reading that costs a fraction of
            what searching would, which is why a channel-wide analysis is affordable to
            offer for free and why anything charging heavily for it is charging for
            something inexpensive.
          </p>

          <Callout>
            One trap: <Key>subscriber counts are rounded before they are published</Key> —
            to three significant figures. A channel reported as 21.3M might be anywhere in
            a range tens of thousands wide, and two tools showing different figures are
            usually both reading the same rounded number differently. Only the owner sees
            the exact count.
          </Callout>

          <p>
            What is <Key>not</Key> available at channel level is the same list as for
            videos, and then some: watch time, traffic sources, audience demographics,
            subscriber gains and losses per video, and revenue. All of it is Studio-only,
            and no amount of API access substitutes for it.
          </p>
          <p>
            You can see what this adds up to in practice with the{" "}
            <Link
              href="/tools/channel-analyzer"
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              channel audit
            </Link>
            , which grades a channel on everything above and nothing beyond it.
          </p>

          <H2>Gone, permanently</H2>
          <p>
            <Key>Dislikes.</Key> Removed from the public API in December 2021. Any tool
            showing you a dislike count today is estimating it — from browser-extension
            crowdsourcing or from archived pre-2021 data — not reading it. The number is
            not wrong so much as invented.
          </p>

          <Callout>
            A useful test of any YouTube tool: ask it for dislikes. If it gives you a
            confident number without explaining where it came from, treat everything else
            it tells you with the same suspicion.
          </Callout>

          <H2>Owner-only, no matter what you are offered</H2>
          <p>
            <Key>Revenue.</Key> Only the channel owner sees it, in Studio. Public
            estimates — including ours — are views divided by a thousand, multiplied by
            an assumed RPM band. That model cannot know whether the channel is monetised
            at all, where its audience is (US traffic pays several times what most
            markets do), or anything earned through sponsorships, memberships or merch.
            It is a range, and treating it as a figure is a mistake.
          </p>
          <p>
            <Key>Captions and transcripts.</Key> Both listing and downloading captions
            require OAuth authorisation from the channel that owns the video. An API key
            is not enough. This surprises people, because the transcript is visible in
            the YouTube player — visible in the interface and available through the API
            are different things, repeatedly.
          </p>
          <p>
            <Key>Memberships, Super Thanks, merch.</Key> The relevant endpoints reject an
            API key outright — they are owner-scoped OAuth only. Nor is member count or
            tier price published anywhere else. So &ldquo;members × price&rdquo; revenue
            estimates require inventing both numbers.
          </p>
          <p>
            <Key>Whether a video was AI-generated.</Key> There is a disclosure field, but
            YouTube returns it only to the channel that owns the video. For anyone else
            it is unavailable, and absence of a label never means a video is not
            synthetic.
          </p>

          <H2>Why members-only videos cannot be detected either</H2>
          <p>
            A reasonable idea: find a channel&rsquo;s members-only videos by spotting gaps
            in its public uploads. It does not work. Members-only videos are filtered out
            of the uploads playlist entirely, so there is no absence to detect — tested
            across several large channels with active memberships, every video accounted
            for, nothing missing.
          </p>
          <p>
            The only thing that works is scraping the watch page for interface strings,
            which is fragile and against YouTube&rsquo;s terms. It is not a feature you
            will find here for that reason.
          </p>

          <H2>What this is worth knowing for</H2>
          <p>
            Mostly so you can tell research from decoration. A tool showing you tags,
            topics, thumbnails and the full technical record is reading real data. A tool
            showing you dislikes, revenue or member counts is running a model, and the
            honest ones say so.
          </p>
          <p>
            The useful stuff is largely the unglamorous stuff: what the uploader actually
            wrote, what Google inferred, and how the numbers moved over time.
          </p>
        </Prose>
      </ArticleShell>
    </>
  );
}

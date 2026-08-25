import { ExplainerGroup, Fold, Lit } from "./Fold";

/**
 * Long-form write-ups for every section of the result card.
 *
 * Deliberately NOT a repeat of FIELD_INFO — the "?" hints answer *what is this
 * and where does it live on YouTube*. These answer *how do I read it*, which is
 * the part that needs paragraphs rather than a tooltip.
 *
 * Nothing here is visible by default except the group titles and fold summaries:
 * this sits under the tool and must never compete with it for attention.
 * Server component, native <details>, no JavaScript.
 */
export function Explainers() {
  return (
    <section className="mt-20 border-t border-white/[0.07] pt-12">
      <h2 className="text-lg font-semibold tracking-tight text-slate-200">
        Understanding the data
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        What each field means, and what to do with it.
      </p>

      <div className="mt-7">
        <ExplainerGroup title="Tags">
          <Fold summary="What tags are">
            <p>
              Hidden keywords a creator adds when uploading. They never appear on the
              watch page — which is exactly why reading a competitor&apos;s tags is
              useful.
            </p>
            <p>
              Not every video has them: the field is buried behind &ldquo;Show more&rdquo;
              in YouTube Studio, so plenty of uploads have none at all.
            </p>
          </Fold>

          <Fold summary="Tags vs. hashtags — not the same thing">
            <p>
              <strong className="font-medium text-slate-300">Hashtags</strong> are
              visible: they carry a <Lit>#</Lit>, live in the description, and show above
              the title.
            </p>
            <p>
              <strong className="font-medium text-slate-300">Tags</strong> are invisible,
              carry no <Lit>#</Lit>, and can contain spaces, so a single tag can be a
              whole phrase. This tool extracts tags.
            </p>
          </Fold>

          <Fold summary="Why the order matters">
            <p>
              Tags come back in the order the creator wrote them — and that order is a
              tell. Most people start with their brand, widen to broad category terms,
              then finish with niche phrases. Reading it top to bottom shows you what
              they think the video is really about, and which terms they prioritised.
            </p>
          </Fold>

          <Fold summary="Reading a competitor's tags">
            <p>
              <strong className="font-medium text-slate-300">No tags?</strong> Common, and
              good news — anything you add puts you ahead. Take your cues from their
              title, description, and hashtags instead.
            </p>
            <p>
              <strong className="font-medium text-slate-300">Has tags?</strong> Judge the
              quality. Match their broad terms to stay competitive, then add niche ones
              they missed — that&apos;s where you can actually win.
            </p>
          </Fold>

          <Fold summary="Writing your own tags">
            <p>
              You get 500 characters in total, which is more room than most people use.
              Lowercase, alphanumeric, no <Lit>#</Lit>.
            </p>
            <p>
              Because tags are hidden, they&apos;re the right place for misspellings of
              your brand or product, plus slang and abbreviations people actually type —
              YouTube itself suggests this. And you can edit tags after publishing, so a
              video that&apos;s underperforming is worth revisiting.
            </p>
          </Fold>

          <Fold summary="Do tags affect ranking?">
            <p>
              Honestly: nobody outside YouTube knows how much weight they carry, and
              anyone claiming a precise number is guessing. Title, description,
              thumbnail, and watch time matter more. Tags are cheap to get right,
              though — the more signals YouTube has about your video, the better.
            </p>
          </Fold>
        </ExplainerGroup>

        <ExplainerGroup title="Topic categories">
          <Fold summary="Why these are worth more than tags">
            <p>
              Topics are assigned by Google, not the uploader — the platform&apos;s own
              read of what a video is about, expressed as Wikipedia categories.
            </p>
            <p>
              Tags tell you what a creator <em>claims</em> the video is about. Topics tell
              you what Google actually <em>concluded</em> — and Google is the one deciding
              what to recommend it alongside. When the two disagree, the topics win.
            </p>
          </Fold>

          <Fold summary="Using them on your own videos">
            <p>
              You cannot set topics directly. You influence them through the title,
              description, and spoken content.
            </p>
            <p>
              So look up your own video here. If the topics that come back are not the
              subject you were aiming at, your metadata is pointing Google somewhere you
              did not intend — and that misfire is likely showing up in who gets
              recommended the video.
            </p>
          </Fold>

          <Fold summary="Why the list is often broad">
            <p>
              Topics are coarse by design — you will see wide buckets like music or
              technology far more often than narrow ones. A broad topic is not a problem;
              a <em>wrong</em> one is.
            </p>
          </Fold>
        </ExplainerGroup>

        <ExplainerGroup title="Statistics history">
          <Fold summary="Where this data comes from">
            <p>
              The YouTube API returns only the counts as they stand right now. It has no
              endpoint for the past. Every history point here exists because this site
              recorded a snapshot when someone looked the video up.
            </p>
            <p>
              So a video&apos;s curve starts the first time it is looked up here — there
              is no way to recover the weeks before that, for us or for anyone else. If
              there is a video you care about tracking, look it up sooner rather than
              later. The record starts when you start.
            </p>
          </Fold>

          <Fold summary="Reading the curve">
            <p>
              Totals tell you what a video has earned over its whole life, which mostly
              measures how long it has existed. The slope tells you what it is doing now.
            </p>
            <p>
              A flat line on a large number is an old hit coasting. A steep line on a
              small number is something working today — and that is the one worth
              studying, because whatever it is doing is currently working.
            </p>
          </Fold>

          <Fold summary="Watch for the re-recommendation spike">
            <p>
              Older videos sometimes jump sharply months after publishing, when YouTube
              starts surfacing them again. If a competitor&apos;s back catalogue suddenly
              moves, that is a signal about what the algorithm is favouring right now,
              not about anything they did that week.
            </p>
          </Fold>
        </ExplainerGroup>

        <ExplainerGroup title="Views, likes, and comments">
          <Fold summary="Ratios beat totals">
            <p>
              Raw counts are the least interesting thing here. Likes per view and comments
              per view say more about how a video landed than the view count does. A
              modest video with an unusually high like rate found its audience; a large
              one with a low rate was probably pushed to people who did not care.
            </p>
            <p>
              Compare within a niche, not across the platform. What counts as a strong
              rate differs enormously between, say, music and tutorials, so a universal
              benchmark would mislead you.
            </p>
          </Fold>

          <Fold summary="Comments are the loudest signal">
            <p>
              Commenting costs far more effort than liking. A high comment rate relative
              to views usually means the video provoked something — disagreement,
              questions, strong feeling. That is worth investigating regardless of
              whether the totals are impressive.
            </p>
          </Fold>

          <Fold summary="Why there are no dislikes">
            <p>
              YouTube removed public dislike counts from the API in December 2021. No
              tool can show them, and any that claims to is estimating. We would rather
              show nothing than a guess.
            </p>
          </Fold>
        </ExplainerGroup>

        <ExplainerGroup title="Thumbnails">
          <Fold summary="Getting the full-resolution image">
            <p>
              YouTube generates a set of sizes from the single image a creator uploads.
              The largest, 1280×720, is the closest thing to the file they actually
              made — useful for studying composition, text placement, and face framing.
            </p>
            <p>
              It is not guaranteed to exist on every video, particularly older or
              lower-resolution uploads. When it is missing, the next size down is the
              best available.
            </p>
          </Fold>

          <Fold summary="What to look for in a competitor's thumbnail">
            <p>
              Check it at the smallest size too. Most viewers meet a thumbnail as a
              postage stamp on a phone, and a design that only works large is a design
              that fails where it counts.
            </p>
          </Fold>
        </ExplainerGroup>

        <ExplainerGroup title="Technical flags">
          <Fold summary="Made for kids has real costs">
            <p>
              When a video is marked as made for kids, YouTube switches off comments,
              notifications, save-to-playlist, and personalised ads on it. Creators
              sometimes set this without realising how much reach and revenue it removes.
            </p>
            <p>
              If you are wondering why a channel&apos;s comments are missing, check this
              flag first.
            </p>
          </Fold>

          <Fold summary="Captions, embedding, and licensing">
            <p>
              <strong className="font-medium text-slate-300">Captions</strong> — reports
              the caption track YouTube lists for the video. Treat it as a rough indicator
              rather than proof of whether automatic captions exist.
            </p>
            <p>
              <strong className="font-medium text-slate-300">Embeddable</strong> — whether
              the video can be played on other sites. Turning it off closes a real
              distribution channel.
            </p>
            <p>
              <strong className="font-medium text-slate-300">Licensed content</strong> —
              flags material claimed through the YouTube rights system, which usually
              means a music label, studio, or network is behind it.
            </p>
          </Fold>
        </ExplainerGroup>

        <ExplainerGroup title="Description">
          <Fold summary="The first two lines do the work">
            <p>
              YouTube truncates the description behind &ldquo;…more&rdquo;, so only the
              opening is written for humans. Everything below it — link stacks, affiliate
              blocks, boilerplate — is written for search and for the algorithm.
            </p>
            <p>
              Reading a competitor&apos;s full description shows you which keywords they
              are quietly targeting and which partners they work with.
            </p>
          </Fold>

          <Fold summary="Timestamps become chapters">
            <p>
              A list of timestamps starting at <Lit>0:00</Lit> turns into the chapter
              markers on the player&apos;s progress bar. If a video has chapters and you
              were wondering how, this is where they came from.
            </p>
          </Fold>
        </ExplainerGroup>

        <ExplainerGroup title="Raw API response">
          <Fold summary="When you would want the raw JSON">
            <p>
              This page renders the fields worth reading, but the API returns more —
              localisations, region restrictions, and assorted flags. If you need
              something we do not display, or you are building against the API yourself,
              the untouched response has it.
            </p>
          </Fold>
        </ExplainerGroup>
      </div>
    </section>
  );
}

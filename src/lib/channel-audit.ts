import type { ChannelStats } from "./channel-stats";
import type { ChannelData } from "./youtube-channel";

/**
 * The channel audit: a graded checklist, plus what to do about the failures.
 *
 * PURE AND IMPORT-FREE BEYOND TYPES, same rule as channel-stats.ts and tags.ts.
 *
 * TWO RULES THIS FOLLOWS THAT MOST AUDIT TOOLS DO NOT:
 *
 * 1. ENGAGEMENT IS JUDGED AS A RATE, NEVER AS A COUNT. "Low likes: 11" is
 *    meaningless — 11 likes on 300 views is excellent and on 300,000 views is
 *    a disaster. Every engagement check below divides by views or subscribers
 *    first, so the verdict means the same thing for a channel of any size.
 *
 * 2. NOTHING IS SCORED THAT CANNOT BE ACTED ON. There is no check for
 *    subscriber count, because "get more subscribers" is not advice. Counts
 *    that are context rather than judgement are returned as `info` and drawn
 *    without a verdict.
 *
 * THRESHOLDS ARE HEURISTICS AND THE UI SAYS SO. They are collected here rather
 * than scattered through the checks so they can be argued with in one place,
 * and every one has a reason written next to it. They are not from YouTube;
 * nobody outside YouTube has the data to set them precisely.
 */

export type CheckStatus = "good" | "warn" | "bad" | "info";

export type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  /** One line, plain, about THIS channel. */
  message: string;
  /** The figure the verdict was reached from, already formatted. */
  value: string;
  /** True when the check only looked at the recent sample, not everything. */
  sampled?: boolean;
};

export type Recommendation = {
  id: string;
  title: string;
  detail: string;
  /** Checks it came from, so the UI can point back at the evidence. */
  from: string;
};

export type ChannelAudit = {
  sections: { title: string; checks: Check[] }[];
  recommendations: Recommendation[];
  /** good + info, out of everything gradeable. Never shown as a percentage. */
  passed: number;
  gradeable: number;
};

const THRESHOLDS = {
  /** A channel description under this reads as unfinished to a visitor. */
  channelDescriptionChars: 100,
  /** Fewer keywords than this and the channel is barely categorising itself. */
  channelKeywords: 3,
  /** Below one upload a fortnight, a channel reads as dormant to viewers. */
  uploadsPerWeekGood: 1,
  uploadsPerWeekWarn: 0.5,
  /** A video description shorter than this is effectively empty. */
  videoDescriptionChars: 100,
  /**
   * Typical YouTube like rates sit around 2–5% of views. Under 1% is genuinely
   * low rather than merely below average.
   */
  likeRateGood: 0.03,
  likeRateWarn: 0.01,
  /** Comment rates are an order of magnitude smaller than like rates. */
  commentRateGood: 0.002,
  commentRateWarn: 0.0005,
  /**
   * Median views as a share of subscribers. Above ~10% means uploads reliably
   * reach the existing audience; very low means the subscriber number is
   * historical rather than active.
   */
  viewsPerSubGood: 0.1,
  viewsPerSubWarn: 0.02,
} as const;

const pct = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`;
const nf = new Intl.NumberFormat("en-US");

export function auditChannel(d: ChannelData, s: ChannelStats): ChannelAudit {
  const profile: Check[] = [];
  const content: Check[] = [];
  const engagement: Check[] = [];
  const recommendations: Recommendation[] = [];

  /* ---------------- Profile ---------------- */

  const descLen = d.description.trim().length;
  profile.push({
    id: "channelDescription",
    label: "Channel description",
    status: descLen === 0 ? "bad" : descLen < THRESHOLDS.channelDescriptionChars ? "warn" : "good",
    message:
      descLen === 0
        ? "Empty — visitors and search have nothing to go on"
        : descLen < THRESHOLDS.channelDescriptionChars
          ? "Short enough to look unfinished"
          : "Substantial enough to explain the channel",
    value: `${nf.format(descLen)} characters`,
  });
  if (descLen < THRESHOLDS.channelDescriptionChars) {
    recommendations.push({
      id: "channelDescription",
      title: descLen === 0 ? "Write a channel description" : "Expand the channel description",
      detail:
        `Aim for at least ${THRESHOLDS.channelDescriptionChars} characters saying what the ` +
        "channel covers and who it is for. It appears in search results and on the About tab.",
      from: "Channel description",
    });
  }

  profile.push({
    id: "channelKeywords",
    label: "Channel keywords",
    status:
      d.keywords.length === 0
        ? "bad"
        : d.keywords.length < THRESHOLDS.channelKeywords
          ? "warn"
          : "good",
    message:
      d.keywords.length === 0
        ? "None set — a free signal being left on the table"
        : d.keywords.length < THRESHOLDS.channelKeywords
          ? "Only a couple set"
          : "Set, and describing the channel",
    value: `${d.keywords.length} keyword${d.keywords.length === 1 ? "" : "s"}`,
  });
  if (d.keywords.length < THRESHOLDS.channelKeywords) {
    recommendations.push({
      id: "channelKeywords",
      title: "Add channel keywords",
      detail:
        "YouTube Studio → Settings → Channel → Basic info. They are invisible to viewers " +
        "and help YouTube place the channel. Include the topic, the format, and any " +
        "spellings of the channel name people get wrong.",
      from: "Channel keywords",
    });
  }

  profile.push({
    id: "channelCountry",
    label: "Country",
    status: d.country ? "good" : "warn",
    message: d.country ? "Set" : "Not set — YouTube has less to work with on placement",
    value: d.country ?? "Not set",
  });
  if (!d.country) {
    recommendations.push({
      id: "channelCountry",
      title: "Set the channel country",
      detail:
        "Studio → Settings → Channel → Advanced settings. One field, and it helps YouTube " +
        "decide which audiences to show the channel to.",
      from: "Country",
    });
  }

  profile.push({
    id: "channelHandle",
    label: "Handle",
    status: d.customUrl ? "good" : "warn",
    message: d.customUrl ? "Claimed" : "Not claimed — the channel has no memorable URL",
    value: d.customUrl ?? "Not claimed",
  });

  /* ---------------- Content ---------------- */

  content.push({
    id: "videoCount",
    label: "Videos published",
    status: "info",
    message: "Public uploads on the channel",
    value: d.videoCount !== null ? nf.format(d.videoCount) : "—",
  });

  if (s.uploadsPerWeek !== null) {
    const f = s.uploadsPerWeek;
    content.push({
      id: "uploadFrequency",
      label: "Posting frequency",
      status:
        f >= THRESHOLDS.uploadsPerWeekGood
          ? "good"
          : f >= THRESHOLDS.uploadsPerWeekWarn
            ? "warn"
            : "bad",
      message:
        f >= THRESHOLDS.uploadsPerWeekGood
          ? "Publishing regularly"
          : f >= THRESHOLDS.uploadsPerWeekWarn
            ? "Roughly fortnightly — viewers lose the habit at this pace"
            : "Infrequent enough that the channel reads as dormant",
      // Stated per week, and per month when weekly would round to something
      // useless. "0 videos a day" is the classic way this figure is made
      // meaningless.
      value:
        f >= 1
          ? `${f.toFixed(1)} a week`
          : `${(f * 4.345).toFixed(1)} a month`,
      sampled: true,
    });

    if (f < THRESHOLDS.uploadsPerWeekGood) {
      recommendations.push({
        id: "uploadFrequency",
        title: "Publish more regularly",
        detail:
          "Consistency matters more than volume — a predictable weekly slot beats bursts " +
          "followed by silence, because YouTube and viewers both learn the pattern.",
        from: "Posting frequency",
      });
    }
  }

  // Sample-based content checks and everything about engagement continue in
  // finish(), which is where the recent-uploads list is read.
  return finish(d, s, profile, content, engagement, recommendations);
}

function finish(
  d: ChannelData,
  s: ChannelStats,
  profile: Check[],
  content: Check[],
  engagement: Check[],
  recommendations: Recommendation[]
): ChannelAudit {
  const recent = d.recent;
  const sample = recent.length;

  if (sample > 0) {
    const untagged = recent.filter((v) => v.tagCount === 0).length;
    content.push({
      id: "videoTags",
      label: "Videos with tags",
      status: untagged === 0 ? "good" : untagged <= sample * 0.25 ? "warn" : "bad",
      message:
        untagged === 0
          ? "Every recent video has tags"
          : `${untagged} of ${sample} recent videos have no tags at all`,
      value: `${sample - untagged}/${sample}`,
      sampled: true,
    });
    if (untagged > 0) {
      recommendations.push({
        id: "videoTags",
        title: "Add tags to the videos missing them",
        detail:
          `${untagged} recent upload${untagged === 1 ? " has" : "s have"} none. Tags are ` +
          "editable after publishing, so this is fixable on videos already live.",
        from: "Videos with tags",
      });
    }

    const thin = recent.filter((v) => v.descriptionLength < 100).length;
    content.push({
      id: "videoDescriptions",
      label: "Video descriptions",
      status: thin === 0 ? "good" : thin <= sample * 0.25 ? "warn" : "bad",
      message:
        thin === 0
          ? "All recent videos have a real description"
          : `${thin} of ${sample} recent videos have little or no description`,
      value: `${sample - thin}/${sample}`,
      sampled: true,
    });
    if (thin > 0) {
      recommendations.push({
        id: "videoDescriptions",
        title: "Fill in the thin video descriptions",
        detail:
          "The first two lines show above the fold and are what search reads. Also editable " +
          "after publishing.",
        from: "Video descriptions",
      });
    }
  }

  /* ---------------- Engagement ---------------- */

  engagement.push({
    id: "subscribers",
    label: "Subscribers",
    status: "info",
    message: d.subscribersHidden
      ? "Hidden by this channel"
      : "Rounded by YouTube, not by us",
    value:
      d.subscribersHidden || d.subscriberCount === null
        ? "Hidden"
        : nf.format(d.subscriberCount),
  });

  if (s.medianViews !== null) {
    engagement.push({
      id: "medianViews",
      label: "Typical views",
      status: "info",
      message: "Median across the recent sample — the mean is skewed by any one hit",
      value: nf.format(s.medianViews),
      sampled: true,
    });

    // Reach relative to audience size. This is the check the count-based
    // version of this tool cannot do, and the one that actually says something.
    if (d.subscriberCount && d.subscriberCount > 0 && !d.subscribersHidden) {
      const ratio = s.medianViews / d.subscriberCount;
      engagement.push({
        id: "viewsPerSubscriber",
        label: "Reach vs subscribers",
        status:
          ratio >= THRESHOLDS.viewsPerSubGood
            ? "good"
            : ratio >= THRESHOLDS.viewsPerSubWarn
              ? "warn"
              : "bad",
        message:
          ratio >= THRESHOLDS.viewsPerSubGood
            ? "Uploads reliably reach the audience"
            : ratio >= THRESHOLDS.viewsPerSubWarn
              ? "Only part of the subscriber base is watching"
              : "Most subscribers are not seeing these uploads",
        value: pct(ratio),
        sampled: true,
      });
      if (ratio < THRESHOLDS.viewsPerSubWarn) {
        recommendations.push({
          id: "viewsPerSubscriber",
          title: "Work on thumbnails and titles before anything else",
          detail:
            "Typical views are a small fraction of the subscriber count, which usually means " +
            "uploads are being served and not clicked — a packaging problem, not a reach one.",
          from: "Reach vs subscribers",
        });
      }
    }
  }

  if (s.likeRate !== null) {
    engagement.push({
      id: "likeRate",
      label: "Like rate",
      status:
        s.likeRate >= THRESHOLDS.likeRateGood
          ? "good"
          : s.likeRate >= THRESHOLDS.likeRateWarn
            ? "warn"
            : "bad",
      message:
        s.likeRate >= THRESHOLDS.likeRateGood
          ? "Healthy — above the usual range"
          : s.likeRate >= THRESHOLDS.likeRateWarn
            ? "Within the usual range, with room to move"
            : "Low — viewers are watching without responding",
      value: `${pct(s.likeRate)} of views`,
      sampled: true,
    });
    if (s.likeRate < THRESHOLDS.likeRateWarn) {
      recommendations.push({
        id: "likeRate",
        title: "Ask for the like, once, at the right moment",
        detail:
          "Not at the start. After the payoff, when the viewer has had something worth " +
          "responding to. Like rate is one of the cheapest numbers to move.",
        from: "Like rate",
      });
    }
  }

  if (s.commentRate !== null) {
    engagement.push({
      id: "commentRate",
      label: "Comment rate",
      status:
        s.commentRate >= THRESHOLDS.commentRateGood
          ? "good"
          : s.commentRate >= THRESHOLDS.commentRateWarn
            ? "warn"
            : "bad",
      message:
        s.commentRate >= THRESHOLDS.commentRateGood
          ? "An active comment section"
          : s.commentRate >= THRESHOLDS.commentRateWarn
            ? "Quiet but alive"
            : "Very quiet — or comments may be disabled",
      value: `${pct(s.commentRate)} of views`,
      sampled: true,
    });
    if (s.commentRate < THRESHOLDS.commentRateWarn) {
      recommendations.push({
        id: "commentRate",
        title: "Give viewers something specific to answer",
        detail:
          "An open invitation to comment gets nothing. A narrow question about the video — " +
          "a disagreement, a choice, a request — gets replies.",
        from: "Comment rate",
      });
    }
  }

  const sections = [
    { title: "Profile", checks: profile },
    { title: "Content", checks: content },
    { title: "Engagement", checks: engagement },
  ].filter((sec) => sec.checks.length > 0);

  const gradeableChecks = sections.flatMap((sec) =>
    sec.checks.filter((c) => c.status !== "info")
  );

  return {
    sections,
    recommendations,
    passed: gradeableChecks.filter((c) => c.status === "good").length,
    gradeable: gradeableChecks.length,
  };
}

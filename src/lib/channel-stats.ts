import type { ChannelVideo } from "./youtube-channel";

/**
 * What can honestly be said about a channel from its recent uploads.
 *
 * PURE, AND FREE OF IMPORTS BEYOND A TYPE — the same rule lib/tags.ts documents.
 * These figures are rendered on the client and computed on the server, and the
 * only way to guarantee they agree is one module both can load.
 *
 * EVERYTHING HERE IS ABOUT THE RECENT SAMPLE, NOT THE CHANNEL'S LIFETIME. A
 * channel's all-time average view count is a number about 2016; what a creator
 * wants to know is what happens when this channel uploads now. Every field
 * below is therefore scoped to the videos passed in, and the UI says so.
 */

/** Below this, YouTube treats an upload as a Short. */
const SHORT_MAX_SECONDS = 60;

/** Mid-roll ads become available here, which is why creators target it. */
const MID_ROLL_SECONDS = 8 * 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ChannelStats = {
  sampleSize: number;
  /** Median views across the sample. See the note on why this is not the mean. */
  medianViews: number | null;
  meanViews: number | null;
  bestVideo: ChannelVideo | null;
  worstVideo: ChannelVideo | null;
  /** Uploads per week, from the span the sample actually covers. */
  uploadsPerWeek: number | null;
  daysSinceLastUpload: number | null;
  /** Share of the sample that is Shorts, 0–1. */
  shortsShare: number | null;
  /** Share at or over the mid-roll threshold, 0–1. */
  midRollShare: number | null;
  medianDurationSeconds: number | null;
  /** Likes ÷ views across the sample, 0–1. */
  likeRate: number | null;
  /** Comments ÷ views across the sample, 0–1. */
  commentRate: number | null;
  /** Busiest upload weekday, 0 = Sunday, or null when there is no clear one. */
  busiestWeekday: number | null;
};

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

export function computeChannelStats(videos: ChannelVideo[]): ChannelStats {
  const empty: ChannelStats = {
    sampleSize: 0,
    medianViews: null,
    meanViews: null,
    bestVideo: null,
    worstVideo: null,
    uploadsPerWeek: null,
    daysSinceLastUpload: null,
    shortsShare: null,
    midRollShare: null,
    medianDurationSeconds: null,
    likeRate: null,
    commentRate: null,
    busiestWeekday: null,
  };

  if (!videos.length) return empty;

  const withViews = videos.filter((v) => v.viewCount !== null);
  const views = withViews.map((v) => v.viewCount as number);

  /**
   * MEDIAN IS THE HEADLINE, mean is the footnote, and the gap between them is
   * itself informative. One viral video drags a mean far above anything the
   * channel typically does — quote the mean and you tell a creator their
   * competitor reliably gets numbers they in fact hit once.
   */
  const medianViews = median(views);
  const meanViews = views.length
    ? Math.round(views.reduce((a, b) => a + b, 0) / views.length)
    : null;

  const sortedByViews = [...withViews].sort(
    (a, b) => (b.viewCount as number) - (a.viewCount as number)
  );

  const dates = videos
    .map((v) => Date.parse(v.publishedAt))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  /**
   * Cadence from the span the sample COVERS, not from a fixed window: fifty
   * videos might be three weeks of a daily channel or four years of an occasional
   * one, and dividing by a guessed period would misdescribe both.
   */
  let uploadsPerWeek: number | null = null;
  if (dates.length > 1) {
    const spanDays = (dates[dates.length - 1] - dates[0]) / DAY_MS;
    // A burst of uploads inside one day would divide by ~0 and report infinity.
    if (spanDays >= 1) uploadsPerWeek = ((dates.length - 1) / spanDays) * 7;
  }

  const daysSinceLastUpload = dates.length
    ? Math.floor((Date.now() - dates[dates.length - 1]) / DAY_MS)
    : null;

  const durations = videos
    .map((v) => v.durationSeconds)
    .filter((d): d is number => d !== null && d > 0);

  const shortsShare = durations.length
    ? durations.filter((d) => d <= SHORT_MAX_SECONDS).length / durations.length
    : null;

  const midRollShare = durations.length
    ? durations.filter((d) => d >= MID_ROLL_SECONDS).length / durations.length
    : null;

  /**
   * Engagement is computed over TOTALS, not as the average of per-video rates.
   * Averaging rates lets a video with 40 views and 8 likes count as heavily as
   * one with four million, and that one outlier then defines the channel.
   */
  const totalViews = views.reduce((a, b) => a + b, 0);
  const totalLikes = withViews.reduce((a, v) => a + (v.likeCount ?? 0), 0);
  const totalComments = withViews.reduce((a, v) => a + (v.commentCount ?? 0), 0);
  const hasLikes = withViews.some((v) => v.likeCount !== null);
  const hasComments = withViews.some((v) => v.commentCount !== null);

  const weekdayCounts = new Array(7).fill(0) as number[];
  for (const t of dates) weekdayCounts[new Date(t).getDay()] += 1;
  const topCount = Math.max(...weekdayCounts);
  // Only claim a pattern when one day genuinely leads; a tie is not a schedule.
  const leaders = weekdayCounts.filter((c) => c === topCount).length;
  const busiestWeekday =
    dates.length >= 7 && leaders === 1 ? weekdayCounts.indexOf(topCount) : null;

  return {
    sampleSize: videos.length,
    medianViews,
    meanViews,
    bestVideo: sortedByViews[0] ?? null,
    worstVideo: sortedByViews[sortedByViews.length - 1] ?? null,
    uploadsPerWeek,
    daysSinceLastUpload,
    shortsShare,
    midRollShare,
    medianDurationSeconds: median(durations),
    likeRate: hasLikes && totalViews > 0 ? totalLikes / totalViews : null,
    commentRate: hasComments && totalViews > 0 ? totalComments / totalViews : null,
    busiestWeekday,
  };
}

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

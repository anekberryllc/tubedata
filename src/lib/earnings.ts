import type { VideoMetadata } from "./youtube";

/**
 * Estimated ad earnings from public metadata alone.
 *
 *     earnings = (views / 1000) × RPM
 *
 * RPM — revenue per 1000 views, already net of YouTube's 45% cut — is the only
 * unknown, so the estimate is quoted as the RANGE produced by a plausible RPM
 * band rather than a single figure. Presenting one number here would be a lie
 * dressed as arithmetic.
 *
 * WHAT THIS CANNOT KNOW, and why the band is wide:
 *   - Whether the channel is in the Partner Programme at all. A video with 2M
 *     views may have earned exactly nothing. No API field exposes this.
 *   - Audience geography. The same video earns 5-10× more on US traffic than
 *     on IN/BR traffic, and there is no public per-video country breakdown.
 *   - Everything that is not AdSense — sponsorships, memberships, merch — which
 *     for most mid-size channels is the larger half of the income.
 *
 * This is TubeData's own model output, NOT data obtained from YouTube. It must
 * always be labelled as an estimate wherever it is shown.
 */

/**
 * RPM bands by YouTube category id: [low, high, label].
 *
 * Rough industry-reported figures for a US-weighted audience, not measurements.
 * They are the weakest link in the whole model — if this feature earns its
 * keep, calibrate them against RPMs that Pro users report from their own Studio
 * rather than trusting these defaults indefinitely.
 */
const RPM_BANDS: Record<string, [number, number, string]> = {
  "1": [1.5, 5, "Film & Animation"],
  "2": [3, 9, "Autos & Vehicles"],
  "10": [0.8, 3, "Music"],
  "15": [1.5, 5, "Pets & Animals"],
  "17": [2, 6, "Sports"],
  "19": [2, 7, "Travel & Events"],
  "20": [1.5, 5, "Gaming"],
  "22": [1.5, 6, "People & Blogs"],
  "23": [1.5, 5, "Comedy"],
  "24": [1.5, 5, "Entertainment"],
  "25": [2, 8, "News & Politics"],
  "26": [3, 10, "Howto & Style"],
  "27": [4, 12, "Education"],
  "28": [5, 15, "Science & Technology"],
  "29": [1, 4, "Nonprofits & Activism"],
};

const DEFAULT_BAND: [number, number, string] = [1.5, 6, "Uncategorised"];

/** Shorts are paid from a revenue pool, not by ad impression — a different world. */
const SHORTS_BAND: [number, number] = [0.02, 0.08];
const SHORTS_MAX_SECONDS = 180;

/** Mid-roll ad slots unlock at 8 minutes, and more slots means a higher RPM. */
const MIDROLL_MIN_SECONDS = 480;
const MIDROLL_UPLIFT = 1.35;

/** Made-for-kids videos get no personalised ads, which guts the rate. */
const MADE_FOR_KIDS_FACTOR = 0.35;

export type EarningsEstimate = {
  /** Lifetime public view count the estimate was computed from. */
  views: number;
  /** Low and high of the earnings range, in USD. */
  low: number;
  high: number;
  /** The assumed RPM band behind those figures, after every adjustment. */
  rpmLow: number;
  rpmHigh: number;
  /** Category the band came from, for display. */
  category: string;
  format: "short" | "midroll" | "standard";
  /** Plain-language reasons the band was moved, shown with the estimate. */
  adjustments: string[];
};

const round2 = (x: number) => Math.round(x * 100) / 100;

export function estimateEarnings(v: VideoMetadata): EarningsEstimate | null {
  // No view count means no basis for the arithmetic at all.
  if (v.viewCount === null || v.viewCount === undefined) return null;

  const seconds = v.durationSeconds ?? 0;
  const isShort = seconds > 0 && seconds <= SHORTS_MAX_SECONDS;
  const [bandLow, bandHigh, category] = RPM_BANDS[v.categoryId] ?? DEFAULT_BAND;

  const adjustments: string[] = [];
  let rpmLow: number;
  let rpmHigh: number;

  if (isShort) {
    // Deliberately replaces the category band rather than discounting it: a
    // Short does not earn a fraction of long-form rates, it earns on entirely
    // separate terms. Applying the category band here would overstate a viral
    // Short by two orders of magnitude.
    [rpmLow, rpmHigh] = SHORTS_BAND;
    adjustments.push("Paid from the Shorts revenue pool, not by ad impression");
  } else {
    rpmLow = bandLow;
    rpmHigh = bandHigh;

    if (seconds >= MIDROLL_MIN_SECONDS) {
      rpmLow *= MIDROLL_UPLIFT;
      rpmHigh *= MIDROLL_UPLIFT;
      adjustments.push("Over 8 minutes, so mid-roll ad slots are eligible");
    }
  }

  if (v.madeForKids) {
    rpmLow *= MADE_FOR_KIDS_FACTOR;
    rpmHigh *= MADE_FOR_KIDS_FACTOR;
    adjustments.push("Made for kids — no personalised ads, so a much lower rate");
  }

  const thousands = v.viewCount / 1000;

  return {
    views: v.viewCount,
    low: round2(thousands * rpmLow),
    high: round2(thousands * rpmHigh),
    rpmLow: round2(rpmLow),
    rpmHigh: round2(rpmHigh),
    category,
    format: isShort ? "short" : seconds >= MIDROLL_MIN_SECONDS ? "midroll" : "standard",
    adjustments,
  };
}

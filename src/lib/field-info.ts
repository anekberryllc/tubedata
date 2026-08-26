/**
 * Explanations shown next to each section of the result card.
 *
 * `what`  — what the field actually is.
 * `where` — where a viewer would find it on YouTube itself, which is the part
 *           people get wrong. Several of these fields are not visible anywhere
 *           on the watch page; they only exist in the API or in Studio.
 */

export type FieldInfo = {
  what: string;
  where: string;
  /** True when the field is invisible to ordinary viewers on youtube.com. */
  hidden?: boolean;
};

export const FIELD_INFO: Record<string, FieldInfo> = {
  overview: {
    what: "The video's headline details — title, channel, publish date, and runtime.",
    where:
      "Title and channel sit directly under the player. The publish date appears beside the view count. Runtime is burned into the corner of the thumbnail and shown on the player's scrub bar.",
  },

  engagement: {
    what: "Live counts of views, likes, and comments at the moment of lookup.",
    where:
      "Views appear under the title, likes on the thumbs-up button, and the comment count above the comment section. Dislikes were removed from the public API in December 2021, so no tool can show them.",
  },

  earnings: {
    what:
      "An estimate of lifetime ad revenue, calculated as views ÷ 1,000 × an assumed RPM band for this category, length and audience type. It is our own model, not a figure from YouTube, so it is shown as a range rather than a number.",
    where:
      "Nowhere. Only the uploader can see real revenue, in YouTube Studio. The range cannot know whether the channel is monetised at all, where its audience is (US traffic pays several times what most other markets do), or anything earned outside ads through sponsorships, memberships or merch.",
    hidden: true,
  },

  thumbnails: {
    what:
      "Every preview image YouTube generated for this video, from 120px up to 1280×720, each with a direct link.",
    where:
      "The one you see in search results and on the home page is a single size from this set. YouTube produces the rest automatically for different devices and layouts.",
  },

  tags: {
    what:
      "Keywords the uploader attached to help YouTube understand and match the video to searches.",
    where:
      "Nowhere on the watch page. Tags are invisible to viewers — the uploader enters them privately in YouTube Studio. This is why tag research is a paid feature in most YouTube tools.",
    hidden: true,
  },

  topics: {
    what:
      "Subject classifications Google assigns automatically, linked to Wikipedia categories.",
    where:
      "Not shown to viewers and not chosen by the uploader. Google derives these from the video's content and metadata, and uses them to shape recommendations.",
    hidden: true,
  },

  technical: {
    what:
      "Playback and policy flags — resolution, captions, audio language, kids designation, embedding, and licensing.",
    where:
      "Captions surface as the CC button in the player. Resolution appears in the quality menu. The rest are set by the uploader in Studio and affect how the video is distributed rather than how it looks.",
  },

  history: {
    what:
      "How this video's view, like, and comment counts have changed over time, captured each time it is looked up.",
    where:
      "Nowhere — not on YouTube, and not available from its API. YouTube reports only the count right now. Historical figures exist solely because this site records a snapshot on every lookup.",
    hidden: true,
  },

  description: {
    what: "The full text the uploader wrote beneath the video.",
    where:
      "The collapsible box under the player, behind the “...more” control. Long descriptions are truncated there; the complete text is shown here.",
  },

  raw: {
    what: "The unmodified JSON response from the YouTube Data API.",
    where:
      "Only ever visible to developers calling the API directly. Useful if you want a field this page doesn't display.",
    hidden: true,
  },
};

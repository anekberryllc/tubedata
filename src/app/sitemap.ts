import type { MetadataRoute } from "next";

/**
 * sitemap.xml.
 *
 * ONLY PUBLIC, INDEXABLE PAGES BELONG HERE. Listing /account or /history would
 * invite crawlers to pages that require a session and answer differently to
 * everyone, and robots.ts already tells them not to — a sitemap that contradicts
 * robots.txt is a signal that the site does not know its own shape.
 *
 * Adding a page means adding a line. That is deliberate rather than generated
 * from the filesystem: whether a route should be indexed is a judgement, and
 * walking app/ would quietly enrol every new page including the private ones.
 *
 * `priority` and `changeFrequency` are hints search engines are free to ignore,
 * and largely do. They are set to something honest rather than to 1.0 across
 * the board, which tells them nothing.
 */
const SITE_URL = process.env.AUTH_URL ?? "https://tubedata.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      // The free tool, and the page most likely to be found by search rather
      // than by someone who already knows the product.
      url: `${SITE_URL}/tools/tag-generator`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/tools/channel-analyzer`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      // The guides are the only pages here written to be FOUND rather than
      // used, so they matter more to a crawler than to a visitor who already
      // knows the product.
      url: `${SITE_URL}/guides`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guides/youtube-video-tags`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guides/youtube-hashtags`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/guides/what-youtube-data-is-public`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}

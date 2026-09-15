import type { MetadataRoute } from "next";

/**
 * robots.txt.
 *
 * The disallow list is the point of this file. `/admin` and `/account` and
 * `/history` are per-user or staff-only; `/api` returns JSON that means nothing
 * to a crawler and costs us a YouTube quota unit if it guesses a URL.
 *
 * THIS IS NOT A SECURITY CONTROL — a crawler that ignores robots.txt still
 * cannot reach any of it, because /admin answers 404 to non-admins and the
 * account pages read the session. This only stops well-behaved bots wasting
 * their time and ours.
 *
 * The origin comes from AUTH_URL, the same variable every other absolute URL in
 * this app derives from. WWW is canonical — the apex is a redirect, not a host
 * this app answers on.
 */
const SITE_URL = process.env.AUTH_URL ?? "https://www.tubedata.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/account", "/history", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthDialogProvider } from "@/components/AuthDialog";
import { PendingPurchase } from "@/components/PendingPurchase";
import { SiteFooter } from "@/components/SiteFooter";
import { signIn } from "@/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Canonical origin.
 *
 * WWW IS CANONICAL, and the fallback says so. The apex tubedata.io cannot be
 * served directly: Wix DNS has no ALIAS or CNAME flattening, and a CNAME is
 * forbidden at a zone apex, so the apex is a Wix forward to this host rather
 * than an address the app answers on. Pointing the fallback at the apex meant
 * every canonical tag and sitemap entry named a URL that 404s.
 *
 * AUTH_URL still overrides it, and remains the ONLY place an origin is
 * configured — Auth.js callbacks, the Stripe redirects, robots, the sitemap and
 * the OG image all derive from it. If the apex ever becomes servable (moving
 * DNS to a provider with flattening), change AUTH_URL and this line together.
 */
const SITE_URL = process.env.AUTH_URL ?? "https://www.tubedata.io";

const DESCRIPTION =
  "Paste any YouTube URL and see the full public record — tags, topic categories, " +
  "every thumbnail size, and statistics over time. Free, no account needed.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // Subpages set a bare title and inherit the suffix, so the product name
    // is written once rather than repeated in every page's metadata.
    default: "TubeData — YouTube Metadata Lookup",
    template: "%s — TubeData",
  },
  description: DESCRIPTION,
  applicationName: "TubeData",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "TubeData",
    url: "/",
    title: "TubeData — YouTube Metadata Lookup",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "TubeData — YouTube Metadata Lookup",
    description: DESCRIPTION,
  },
};

/**
 * ROOT LAYOUT — AND IT MUST NOT READ THE SESSION.
 *
 * It used to call `auth()` here to gate blocked accounts. That single line made
 * every route in the application dynamic, because reading cookies during render
 * opts a route out of prerendering — including the guides and the privacy page,
 * which have no per-user content whatsoever and are exactly the pages search
 * engines fetch.
 *
 * So the session-dependent parts moved down one level, into the two route
 * groups:
 *
 *   (app)     — reads the session, renders the full header, and enforces the
 *               blocked-account gate. Dynamic, as it always was.
 *   (content) — reads nothing. Prerendered to static HTML at build time.
 *
 * Route groups do not appear in URLs, so nothing about the site's addresses
 * changed. KEEP COOKIE AND HEADER READS OUT OF THIS FILE — anything added here
 * that touches a request makes the whole site dynamic again, silently.
 *
 * What remains is safe: fonts, metadata, the dialog provider (which only holds
 * a server action, never invoking it during render), and the footer.
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* The dialog lives at the root so the header button and any locked
            panel deep in the page open the same one. */}
        <AuthDialogProvider
          signInAction={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          {/* Resumes a purchase that was interrupted by the sign-in redirect. */}
          <PendingPurchase />
          {children}
          <SiteFooter />
        </AuthDialogProvider>
      </body>
    </html>
  );
}

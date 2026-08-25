import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthHeader } from "@/components/AuthHeader";
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
 * Canonical origin. Reads AUTH_URL so dev keeps generating localhost URLs and
 * production generates tubedata.io ones — the same variable Auth.js and the
 * Stripe redirects already key off, so there is one place to change.
 */
const SITE_URL = process.env.AUTH_URL ?? "https://tubedata.io";

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
          <AuthHeader />
          {children}
          <SiteFooter />
        </AuthDialogProvider>
      </body>
    </html>
  );
}

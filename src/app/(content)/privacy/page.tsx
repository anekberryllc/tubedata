import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/support";
import { FREE_DAILY_LOOKUPS } from "@/lib/limits";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What TubeData collects, why, who it is shared with, and how to have it deleted.",
  alternates: { canonical: "/privacy" },
};

/**
 * Privacy policy.
 *
 * WRITTEN FROM THE SCHEMA, NOT FROM A TEMPLATE. Every claim below corresponds
 * to a column that exists: `lookups.ip_address`, `user.email`, `donations.email`,
 * and so on. A policy that describes data you do not hold is as wrong as one
 * that omits data you do, and the second kind is the one that gets you in
 * trouble. IF YOU CHANGE WHAT IS STORED, CHANGE THIS PAGE IN THE SAME COMMIT.
 *
 * The date below is shown to users as the last update. Move it when the
 * substance changes, not when a typo is fixed.
 *
 * Google's YouTube API Services Terms REQUIRE a site using the API to disclose
 * that it does so and to link both Google's Privacy Policy and the YouTube
 * Terms of Service. That is not optional boilerplate — it is a condition of
 * holding an API key, and it is why the "YouTube" section exists.
 */
const LAST_UPDATED = "15 September 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-400">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Privacy</h1>
        <p className="mt-2 text-xs text-slate-600">Last updated {LAST_UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-slate-400">
          TubeData looks up public information about YouTube videos. This page says
          exactly what we store while doing that, why, and how to get rid of it. It
          describes what the software actually does — if something here is unclear or
          looks wrong, email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-sky-300 underline-offset-4 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          and we will fix the page or the behaviour.
        </p>

        <Section title="If you never sign in">
          <p>
            You can use the lookup and the tag generator without an account. We still
            record each lookup: the video ID and the URL you pasted, whether it came
            from our cache, and{" "}
            <span className="text-slate-300">your IP address</span>.
          </p>
          <p>
            The IP address is there for one reason — the free allowance is{" "}
            {FREE_DAILY_LOOKUPS} lookups a day and, without an account, an address is
            the only thing distinguishing one visitor from another. It is not used to
            build a profile of you, and it is not sold or shared for advertising.
          </p>
        </Section>

        <Section title="If you sign in">
          <p>
            Signing in uses Google. Google tells us your{" "}
            <span className="text-slate-300">name, email address and profile picture
            URL</span>; we never see your Google password, and we cannot read anything
            else in your Google account — including your own YouTube channel.
          </p>
          <p>
            We then store your plan, your prepaid lookup balance, and your lookup
            history so it can be shown back to you. A session is kept in our database
            and identified by a cookie in your browser.
          </p>
        </Section>

        <Section title="If you pay">
          <p>
            Payments are handled entirely by{" "}
            <span className="text-slate-300">Stripe</span>. Card numbers never reach
            our servers and we could not store them if we wanted to. What we keep is a
            Stripe customer reference, which plan you bought, and the amount and date —
            enough to show your purchase history and to answer questions about a
            charge.
          </p>
          <p>
            If you request a refund we store the reason you typed, so a person can read
            it. Tips through &ldquo;buy me a coffee&rdquo; record the amount and the
            email address Stripe collected at checkout.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use cookies for signing in and nothing else. There are no advertising or
            analytics cookies on this site. If you never sign in, the site sets no
            cookie for you at all.
          </p>
        </Section>

        <Section title="YouTube">
          <p>
            TubeData uses YouTube API Services to fetch public video data. By using it
            you are also agreeing to the{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              YouTube Terms of Service
            </a>
            , and Google&rsquo;s handling of data is covered by the{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              Google Privacy Policy
            </a>
            .
          </p>
          <p>
            We only ever request data YouTube publishes about a video. We cannot see
            private videos, private statistics, or anything belonging to a channel
            owner.
          </p>
        </Section>

        <Section title="Who else sees your data">
          <p>
            Four companies, each doing one job and none of them given your data for
            their own purposes:{" "}
            <span className="text-slate-300">Google</span> (sign-in and the YouTube
            API), <span className="text-slate-300">Stripe</span> (payments),{" "}
            <span className="text-slate-300">Neon</span> (the database itself), and our
            email provider, for messages we send you about your account.
          </p>
          <p>We do not sell your data, and we do not share it for advertising.</p>
        </Section>

        <Section title="How long it is kept">
          <p>
            Account data stays until you ask us to delete it. Lookup records are kept
            so history and the daily allowance work. Payment records are kept for as
            long as tax and accounting rules require, which is longer than the rest and
            is not something we can shorten on request.
          </p>
        </Section>

        <Section title="Getting your data, or getting rid of it">
          <p>
            Email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-sky-300 underline-offset-4 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            from the address you signed up with and ask for a copy of your data, a
            correction, or deletion. Deleting your account removes your profile,
            sessions and lookup history; payment records survive for the reason above.
          </p>
          <p>
            Depending on where you live you may have a legal right to these things
            rather than merely our willingness — we do not ask which, and we handle
            every request the same way.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If what we collect changes, this page changes with it and the date at the
            top moves. There is no separate notification, so it is worth re-reading if
            you care.
          </p>
        </Section>

        <div className="mt-14 border-t border-white/[0.07] pt-6 text-sm text-slate-500">
          <Link href="/" className="text-sky-300 underline-offset-4 hover:underline">
            Back to TubeData
          </Link>
        </div>
      </div>
    </main>
  );
}

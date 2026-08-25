import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { isPremium, type Plan } from "@/lib/plans";
import { formatDuration } from "@/lib/youtube";
import { getHistoryCount, getLookupHistory } from "@/lib/lookup-history";
import { LockedPanel } from "@/components/LockedPanel";
import { LoginButton } from "@/components/AuthDialog";

export const metadata: Metadata = {
  title: "Your lookup history",
  description: "Every video you have looked up, newest first.",
};

// Reads the session, so it must never be cached or statically rendered.
export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">
          Your lookup history
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Every video you have analyzed while signed in, newest first.
        </p>
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}

export default async function HistoryPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <Shell>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-slate-400">
            History is tied to your account. Sign in and every lookup you make from
            then on is saved here.
          </p>
          <div className="mt-5 flex justify-center">
            <LoginButton />
          </div>
        </div>
      </Shell>
    );
  }

  const plan = (session.user.plan ?? "free") as Plan;

  // Free users get the count, not the contents — the rows are being recorded
  // either way, so upgrading reveals a real backlog rather than an empty page.
  if (!isPremium(plan)) {
    const count = await getHistoryCount(userId);

    return (
      <Shell>
        {count === 0 ? (
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-slate-400">
              Nothing saved yet. Look up a video while signed in and it will start
              collecting here — even on the free plan.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Look up a video
            </Link>
          </div>
        ) : (
          <LockedPanel
            label="Your saved lookups"
            teaseCount={count}
            teaseNoun={count === 1 ? "video saved" : "videos saved"}
          >
            <div className="space-y-2.5">
              {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                >
                  <div className="h-11 w-20 shrink-0 rounded-lg bg-white/[0.06]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 rounded bg-white/[0.06]" style={{ width: `${70 - i * 7}%` }} />
                    <div className="h-2.5 w-1/3 rounded bg-white/[0.04]" />
                  </div>
                </div>
              ))}
            </div>
          </LockedPanel>
        )}
      </Shell>
    );
  }

  const entries = await getLookupHistory(userId);

  if (entries.length === 0) {
    return (
      <Shell>
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-slate-400">
            No lookups recorded yet. Analyze a video and it will appear here.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Look up a video
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="mb-4 text-xs text-slate-600">
        {entries.length} {entries.length === 1 ? "video" : "videos"}
      </p>

      <ul className="space-y-2.5">
        {entries.map((e) => (
          <li key={e.videoId}>
            <Link
              href={`/?v=${encodeURIComponent(e.videoId)}`}
              className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3 transition hover:border-sky-400/30 hover:bg-sky-400/[0.04]"
            >
              <div className="relative h-[3.4rem] w-24 shrink-0 overflow-hidden rounded-lg bg-black/40">
                {e.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg text-slate-700">
                    ▢
                  </div>
                )}
                {e.durationSeconds !== null && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-px text-[10px] font-medium tabular-nums text-slate-200">
                    {formatDuration(e.durationSeconds)}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200 group-hover:text-white">
                  {e.title ?? e.sourceUrl}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {e.channelTitle ?? "Unknown channel"}
                  {e.status !== "available" && (
                    <span className="ml-2 rounded bg-red-400/10 px-1.5 py-px text-[10px] font-medium text-red-300">
                      {e.status.replace("_", " ")}
                    </span>
                  )}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[11px] tabular-nums text-slate-500">
                  {dateFmt.format(e.lastViewedAt)}
                </p>
                {e.timesViewed > 1 && (
                  <p className="mt-0.5 text-[10px] text-slate-600">{e.timesViewed}× looked up</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

import Link from "next/link";
import type { AdminLookup } from "@/lib/admin-lookups";

/**
 * One row per request, shared by the global lookup search and the per-user
 * page. Both are looking at the same table, so they render it the same way —
 * the only difference is whether the "who" column is worth showing.
 */

const when = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "America/New_York",
});

export function LookupTable({
  rows,
  showUser = true,
}: {
  rows: AdminLookup[];
  /** Off on the per-user page, where every row is the same person. */
  showUser?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 text-center text-sm text-slate-500">
        No lookups match.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
      <table className="w-full min-w-[46rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.07] bg-white/[0.02]">
            <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              When (ET)
            </th>
            <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Video
            </th>
            {showUser && (
              <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Who
              </th>
            )}
            <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-white/[0.04] align-top last:border-0 hover:bg-white/[0.02]"
            >
              <td className="whitespace-nowrap px-4 py-3 text-[11px] tabular-nums text-slate-500">
                {when.format(r.requestedAt)}
              </td>

              <td className="px-4 py-3">
                <div className="flex items-start gap-2.5">
                  {r.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.thumbnail}
                      alt=""
                      loading="lazy"
                      className="h-8 w-14 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-14 shrink-0 items-center justify-center rounded bg-white/[0.04] text-slate-700">
                      ▢
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="max-w-[22rem] truncate text-[13px] text-slate-200">
                      {r.title ?? r.sourceUrl}
                    </p>
                    <p className="mt-0.5 max-w-[22rem] truncate text-[11px] text-slate-600">
                      {r.channelTitle ?? "—"}
                      {r.videoId && (
                        <>
                          {" · "}
                          <a
                            href={`https://www.youtube.com/watch?v=${r.videoId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-slate-500 underline-offset-2 hover:text-sky-300 hover:underline"
                          >
                            {r.videoId}
                          </a>
                        </>
                      )}
                      {r.status && r.status !== "available" && (
                        <span className="ml-2 rounded bg-red-400/10 px-1.5 py-px text-[10px] font-medium text-red-300">
                          {r.status.replace("_", " ")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </td>

              {showUser && (
                <td className="px-4 py-3">
                  {r.userId ? (
                    <Link
                      href={`/admin/users/${r.userId}`}
                      className="text-[12px] text-sky-300 underline-offset-2 hover:underline"
                    >
                      {r.userEmail ?? r.userName ?? r.userId}
                    </Link>
                  ) : (
                    <span className="text-[12px] text-slate-600">anonymous</span>
                  )}
                  <p className="mt-0.5 font-mono text-[11px] text-slate-600">
                    {r.ipAddress ?? "—"}
                  </p>
                </td>
              )}

              <td className="whitespace-nowrap px-4 py-3 text-right">
                {/* Quota units are the number that matters operationally: a
                    cache hit costs nothing against the 10,000/day ceiling. */}
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ${
                    r.cacheHit
                      ? "bg-emerald-400/10 text-emerald-200 ring-emerald-400/25"
                      : "bg-white/5 text-slate-400 ring-white/10"
                  }`}
                >
                  {r.cacheHit ? "cache" : "youtube"}
                </span>
                <p className="mt-0.5 text-[11px] tabular-nums text-slate-600">
                  {r.quotaUnits} quota
                </p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

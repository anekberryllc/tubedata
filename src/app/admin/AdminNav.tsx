import Link from "next/link";
import { countOpenRefunds } from "@/lib/admin-refunds";

/**
 * The admin panel's own navigation. Nothing links here from the public site
 * except the user menu, so once you are inside, this is how you move around.
 *
 * The refunds tab carries a live count of open requests. It is a queue with a
 * person waiting at the other end of it, and it renders on every admin page
 * precisely so that a new request cannot sit unnoticed — which is what
 * happened while the only signal was a banner on one page.
 */
export async function AdminNav({
  current,
}: {
  current: "overview" | "lookups" | "refunds";
}) {
  const openRefunds = await countOpenRefunds();

  const item = (href: string, key: string, label: string, badge?: number) => (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition ${
        current === key
          ? "bg-white/[0.08] font-medium text-slate-100"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
      }`}
    >
      {label}
      {!!badge && (
        <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-200 ring-1 ring-amber-400/30">
          {badge}
        </span>
      )}
    </Link>
  );

  return (
    <nav className="mt-5 flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
      {item("/admin", "overview", "Overview & users")}
      {item("/admin/lookups", "lookups", "All lookups")}
      {item("/admin/refunds", "refunds", "Refunds", openRefunds)}
    </nav>
  );
}

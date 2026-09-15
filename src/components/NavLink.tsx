"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A destination link in the site header.
 *
 * Exists to match ToolsMenu's trigger exactly — same padding, same type size,
 * same highlight when you are on the page it points at — so "Tools" and
 * "Pricing" read as one row of navigation rather than two controls that happen
 * to sit beside each other. A client component only because the active state
 * needs the pathname.
 */
export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (pathname?.startsWith(`${href}/`) ?? false);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center rounded-lg px-2.5 py-1.5 text-[13px] transition ${
        active
          ? "bg-white/[0.07] text-slate-100"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
      }`}
    >
      {children}
    </Link>
  );
}

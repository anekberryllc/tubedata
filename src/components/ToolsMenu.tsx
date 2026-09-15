"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The "Tools" dropdown in the site header.
 *
 * Same positioning constraint as the user menu: the header sets
 * `backdrop-blur`, which makes it a containing block for fixed descendants, so
 * this is absolutely positioned and outside clicks are caught with a document
 * listener rather than a fixed overlay.
 *
 * ADDING A TOOL is a line in TOOLS and nothing else. That is the point of the
 * menu existing while there is only one item in it — the second tool should
 * cost no layout work.
 */

const TOOLS = [
  {
    href: "/tools/tag-generator",
    icon: "🏷️",
    name: "Tag & hashtag generator",
    blurb: "Tags from what people search for on YouTube",
  },
  {
    href: "/tools/channel-analyzer",
    icon: "📊",
    name: "Channel audit",
    blurb: "Graded checklist of what a channel is missing",
  },
] as const;

export function ToolsMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Highlights the trigger while the visitor is on a tool page, so the header
  // says where they are rather than only where they can go.
  const active = pathname?.startsWith("/tools") ?? false;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] transition ${
          open || active
            ? "bg-white/[0.07] text-slate-100"
            : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
        }`}
      >
        Tools
        <span aria-hidden="true" className="text-[10px] text-slate-600">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+0.5rem)] z-[60] w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f19] p-1.5 shadow-2xl shadow-black/60"
        >
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition ${
                pathname === tool.href
                  ? "bg-white/[0.06] text-white"
                  : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <span aria-hidden="true" className="mt-px text-[13px]">
                {tool.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{tool.name}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">
                  {tool.blurb}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

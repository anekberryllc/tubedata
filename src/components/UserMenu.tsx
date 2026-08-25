"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Signed-in user menu.
 *
 * Same positioning constraint as the tip jar: the header sets `backdrop-blur`,
 * which makes it a containing block for fixed descendants, so this dropdown is
 * absolutely positioned and outside clicks are caught with a document listener
 * rather than a fixed overlay.
 */
export function UserMenu({
  email,
  name,
  image,
  planLabel,
  premium,
  signOutAction,
}: {
  email: string | null;
  name: string | null;
  image: string | null;
  planLabel: string;
  premium: boolean;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

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

  async function handleSignOut() {
    setPending(true);
    try {
      await signOutAction();
    } finally {
      // Don't leave the previous visitor's lookup pre-filled for the next one.
      try {
        sessionStorage.removeItem("lastLookup");
      } catch {
        /* sessionStorage can throw in locked-down browser modes */
      }
      // Hard navigation ON PURPOSE. router.push() is a soft navigation: server
      // components would re-render signed-out, but this client tree never
      // unmounts, so premium data already in React state would stay on screen.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    }
  }

  const label = name ?? email ?? "Account";
  const initial = (name ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-[13px] transition ${
          open ? "bg-white/[0.07] text-slate-100" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
        }`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-[11px] font-bold text-slate-950">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate sm:block">{label}</span>
        <span aria-hidden="true" className="text-[10px] text-slate-600">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f19] shadow-2xl shadow-black/60"
        >
          <div className="border-b border-white/[0.07] px-4 py-3">
            <p className="truncate text-[13px] font-medium text-slate-200">{name ?? "Signed in"}</p>
            {email && <p className="mt-0.5 truncate text-[11px] text-slate-500">{email}</p>}
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                premium
                  ? "bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-200 ring-1 ring-amber-400/30"
                  : "bg-white/5 text-slate-400 ring-1 ring-white/10"
              }`}
            >
              {planLabel}
            </span>
          </div>

          <div className="p-1.5">
            <Link
              href="/history"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <span aria-hidden="true">🕘</span>
              Lookup history
            </Link>

            <Link
              href="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              <span aria-hidden="true">⚙️</span>
              Manage account
            </Link>
          </div>

          <div className="border-t border-white/[0.07] p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={pending}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100 disabled:opacity-50"
            >
              <span aria-hidden="true">↪</span>
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

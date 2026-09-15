"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoginButton } from "./AuthDialog";

/**
 * The account cluster for pages that must stay static.
 *
 * WHY THIS EXISTS: reading the session on the server means reading cookies,
 * and a route that reads cookies cannot be prerendered. The guides and the
 * privacy page are the pages most worth serving as static HTML — they are the
 * ones search engines fetch and the ones with no per-user content at all — so
 * the session is fetched here, in the browser, after the static shell is
 * already on screen.
 *
 * THE TRADE, STATED PLAINLY: for a moment after load, a signed-in visitor sees
 * neither their name nor a sign-in button. That is why the placeholder below
 * reserves the space rather than collapsing — the header must not jump once the
 * answer arrives. Nothing here is a security boundary; it decides which link to
 * draw and nothing else.
 *
 * Deliberately NOT the full UserMenu. That needs a server action for sign-out
 * and half a dozen props, and a reader on a guide page wants a way back to
 * their account, not a dropdown. The full menu stays on the app routes.
 */
type SessionUser = { name?: string | null; email?: string | null } | null;

export function ContentAccount() {
  const [user, setUser] = useState<SessionUser>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Auth.js exposes the current session here. A failure is not worth
    // reporting to the reader — it just means the sign-in link is shown.
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (cancelled) return;
        setUser(s?.user ?? null);
        setSettled(true);
      })
      .catch(() => {
        if (!cancelled) setSettled(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!settled) {
    // Same height as the button that replaces it, so the header does not jump.
    return <div aria-hidden="true" className="h-[34px] w-[104px]" />;
  }

  if (!user) return <LoginButton />;

  return (
    <Link
      href="/account"
      className="max-w-[12rem] truncate rounded-lg border border-white/10 px-3 py-1.5 text-[13px] text-slate-300 transition hover:border-white/25 hover:text-white"
    >
      {user.name ?? user.email ?? "Account"}
    </Link>
  );
}

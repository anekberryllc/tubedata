"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PRO_ALLOWANCE_LABEL } from "@/lib/limits";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

type Reason = "default" | "unlock";

type AuthDialogApi = {
  /** Open the dialog. `reason` tailors the copy to why it appeared. */
  open: (reason?: Reason) => void;
  close: () => void;
};

const AuthDialogContext = createContext<AuthDialogApi | null>(null);

/**
 * Access the shared sign-in dialog from anywhere in the tree.
 * Returns a no-op outside the provider so components stay safe to render.
 */
export function useAuthDialog(): AuthDialogApi {
  return useContext(AuthDialogContext) ?? { open: () => {}, close: () => {} };
}

const COPY: Record<Reason, { title: string; body: string }> = {
  default: {
    title: "Log in or sign up",
    body: "One account for both — if it's your first time, signing in creates it.",
  },
  unlock: {
    title: "Sign in to upgrade",
    body: "A subscription is tied to your account, so you'll need to sign in before upgrading to Pro.",
  },
};

/**
 * Holds the dialog once, near the root, so the header button and any locked
 * panel deep in the page open the same thing.
 *
 * `signInAction` is a server action handed down from a server component — the
 * sign-in itself still runs server-side; this only controls visibility.
 */
export function AuthDialogProvider({
  signInAction,
  children,
}: {
  signInAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [openReason, setOpenReason] = useState<Reason | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const open = useCallback((reason: Reason = "default") => setOpenReason(reason), []);
  const close = useCallback(() => setOpenReason(null), []);

  // Close on Escape, and stop the page scrolling behind the dialog.
  useEffect(() => {
    if (!openReason) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [openReason, close]);

  const copy = COPY[openReason ?? "default"];

  return (
    <AuthDialogContext.Provider value={{ open, close }}>
      {children}

      {/* Portalled to <body>: the header's backdrop-blur creates a containing
          block, which would otherwise trap this fixed overlay inside it. */}
      {openReason &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
          >
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
            />

            <div className="animate-rise relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0b101b] p-7 shadow-2xl shadow-black/60">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-[radial-gradient(30rem_10rem_at_50%_100%,rgba(56,189,248,0.18),transparent_70%)]"
              />

              <button
                type="button"
                onClick={close}
                aria-label="Close dialog"
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
              >
                ✕
              </button>

              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-500 text-base font-black text-slate-950">
                  T
                </div>

                <h2
                  id="auth-dialog-title"
                  className="mt-5 text-xl font-semibold tracking-tight text-white"
                >
                  {copy.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{copy.body}</p>

                <form action={signInAction} className="mt-6">
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    <GoogleMark />
                    Continue with Google
                  </button>
                </form>

                <div className="mt-6 space-y-2 border-t border-white/[0.07] pt-5">
                  {[
                    "Every field stays free — tags, topics, history, raw JSON",
                    `Pro adds ${PRO_ALLOWANCE_LABEL} and your saved lookup history`,
                    "No password to remember or reset",
                  ].map((line) => (
                    <div key={line} className="flex gap-2.5 text-xs leading-relaxed text-slate-500">
                      <span className="mt-[3px] text-emerald-400">✓</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </AuthDialogContext.Provider>
  );
}

/** Header trigger. Separate so the server component can render it directly. */
export function LoginButton() {
  const { open } = useAuthDialog();
  return (
    <button
      type="button"
      onClick={() => open("default")}
      className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-lg shadow-black/20 transition hover:bg-slate-100"
    >
      Log in / Sign up
    </button>
  );
}

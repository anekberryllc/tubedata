"use client";

import { useState, useTransition } from "react";
import { blockUser, setUserRole, unblockUser, type ActionResult } from "./actions";
import type { Role } from "@/lib/roles";

/**
 * The per-user controls: promote/demote, block, unblock.
 *
 * Every destructive action is two clicks — the second one inside a panel that
 * spells out what will happen — because these buttons sit in a dense table and
 * a mis-click would suspend a paying customer.
 *
 * The rules this UI enforces are also enforced in the server actions, and the
 * server is the one that matters. Disabling a button here is a courtesy: it
 * explains why something can't be done before you try it.
 */
type Mode = null | "block" | "promote" | "demote";

export function AdminUserControls({
  userId,
  label,
  role,
  blocked,
  isSelf,
}: {
  userId: string;
  /** Email or name, quoted back in the confirmation so you know who this is. */
  label: string;
  role: Role;
  blocked: boolean;
  isSelf: boolean;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        setMode(null);
        setReason("");
      } else {
        setError(result.message);
      }
    });
  }

  const isAdminUser = role === "admin";

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {blocked ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => unblockUser(userId))}
            className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[12px] font-medium text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50"
          >
            {pending ? "Working…" : "Unblock"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || isSelf || isAdminUser}
            title={
              isSelf
                ? "You can't block yourself."
                : isAdminUser
                  ? "Admins can't be blocked — demote to member first."
                  : undefined
            }
            onClick={() => {
              setError(null);
              setMode(mode === "block" ? null : "block");
            }}
            className="rounded-lg border border-red-400/25 bg-red-400/[0.07] px-3 py-1.5 text-[12px] font-medium text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Block
          </button>
        )}

        <button
          type="button"
          disabled={pending || isSelf}
          title={isSelf ? "You can't change your own role." : undefined}
          onClick={() => {
            setError(null);
            const next: Mode = isAdminUser ? "demote" : "promote";
            setMode(mode === next ? null : next);
          }}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isAdminUser ? "Make member" : "Make admin"}
        </button>
      </div>

      {mode === "block" && (
        <div className="w-full rounded-xl border border-red-400/20 bg-red-400/[0.04] p-3 text-left sm:w-80">
          <p className="text-[12px] text-slate-300">
            Block <span className="font-medium text-slate-100">{label}</span>? They
            stay signed in but can&rsquo;t look up videos or buy anything, and they
            will see the reason below.
          </p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Reason (shown to the user)"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => blockUser(userId, reason))}
              className="rounded-lg bg-red-500/90 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
            >
              {pending ? "Blocking…" : "Block account"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode(null)}
              className="rounded-lg px-3 py-1.5 text-[12px] text-slate-400 transition hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(mode === "promote" || mode === "demote") && (
        <div className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left sm:w-80">
          <p className="text-[12px] text-slate-300">
            {mode === "promote" ? (
              <>
                Make <span className="font-medium text-slate-100">{label}</span> an
                admin? They will be able to see every account and block people —
                including you.
              </>
            ) : (
              <>
                Drop <span className="font-medium text-slate-100">{label}</span> to
                member? They lose the admin panel immediately.
              </>
            )}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => setUserRole(userId, mode === "promote" ? "admin" : "member"))
              }
              className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Confirm"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setMode(null)}
              className="rounded-lg px-3 py-1.5 text-[12px] text-slate-400 transition hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="max-w-xs text-right text-[11px] leading-relaxed text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

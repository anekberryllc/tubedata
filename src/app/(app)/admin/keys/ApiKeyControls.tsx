"use client";

import { useState, useTransition } from "react";
import type { AdminApiKey } from "@/lib/api-keys";
import {
  addApiKey,
  clearApiKeyFlags,
  deleteApiKey,
  moveApiKey,
  renameApiKey,
  replaceApiKey,
  setApiKeyActive,
  type KeyActionResult,
} from "./actions";

/**
 * The interactive half of the key pool screen.
 *
 * Keys arrive here ALREADY MASKED (AdminApiKey.masked) and there is no path
 * that brings a full one to the browser. The inputs below are write-only: you
 * can paste a new secret in, you can never read one out.
 */

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<KeyActionResult | null>(null);

  const run = (fn: (fd: FormData) => Promise<KeyActionResult>, fd: FormData) =>
    start(async () => setResult(await fn(fd)));

  return { pending, result, setResult, run };
}

function Notice({ result }: { result: KeyActionResult | null }) {
  if (!result || (result.ok && !result.message)) return null;
  return (
    <p
      className={`mt-2 text-xs ${result.ok ? "text-emerald-300" : "text-red-300"}`}
      role="status"
    >
      {result.message}
    </p>
  );
}

/* ------------------------------------------------------------------ */

export function AddApiKey() {
  const { pending, result, run } = useAction();
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");

  return (
    <form
      action={(fd) => {
        run(addApiKey, fd);
        setKey("");
      }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5"
    >
      <h2 className="text-sm font-medium text-slate-200">Add a key</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Google Cloud Console → APIs &amp; Services → Credentials → Create credentials →
        API key, on a project with the <span className="text-slate-400">YouTube Data API v3</span>{" "}
        enabled. Each project gets its own 10,000 units a day, so a second key means a
        second allowance only if it belongs to a different project.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          name="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label — e.g. tubedata-prod"
          maxLength={80}
          className="min-w-[10rem] flex-1 rounded-xl border border-white/10 bg-[#0a0e18] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none"
        />
        <input
          name="key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza…"
          // Not type="password": this is a server credential being pasted by
          // its owner, not a secret typed where someone may be watching, and
          // masking it makes a mis-paste impossible to spot. Browsers also
          // offer to save password fields, which is wrong for this.
          spellCheck={false}
          autoComplete="off"
          className="min-w-[14rem] flex-1 rounded-xl border border-white/10 bg-[#0a0e18] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !key.trim() || !label.trim()}
          className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-40"
        >
          {pending ? "Checking…" : "Verify & add"}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-slate-600">
        The key is tested against Google before it is saved. That test spends one quota
        unit on it.
      </p>
      <Notice result={result} />
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function ApiKeyRow({
  apiKey,
  first,
  last,
}: {
  apiKey: AdminApiKey;
  first: boolean;
  last: boolean;
}) {
  const { pending, result, run } = useAction();
  const [replacing, setReplacing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [label, setLabel] = useState(apiKey.label);

  const invalid = !!apiKey.invalidAt;
  const status = invalid
    ? { text: "Rejected by Google", cls: "bg-red-400/10 text-red-300 ring-red-400/25" }
    : !apiKey.active
      ? { text: "Off", cls: "bg-white/5 text-slate-400 ring-white/10" }
      : apiKey.exhausted
        ? { text: "Quota spent", cls: "bg-amber-400/10 text-amber-200 ring-amber-400/25" }
        : { text: "In rotation", cls: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25" };

  const act = (fn: (fd: FormData) => Promise<KeyActionResult>, extra: Record<string, string> = {}) => {
    const fd = new FormData();
    fd.set("id", String(apiKey.id));
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    run(fn, fd);
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {renaming ? (
              <form
                action={(fd) => {
                  run(renameApiKey, fd);
                  setRenaming(false);
                }}
                className="flex gap-2"
              >
                <input type="hidden" name="id" value={apiKey.id} />
                <input
                  name="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={80}
                  className="rounded-lg border border-white/10 bg-[#0a0e18] px-2 py-1 text-sm text-slate-100 focus:border-sky-400/40 focus:outline-none"
                />
                <button type="submit" className="text-xs text-sky-300 hover:underline">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLabel(apiKey.label);
                    setRenaming(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="text-sm font-medium text-slate-100">{apiKey.label}</span>
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="text-[11px] text-slate-600 hover:text-slate-300"
                >
                  rename
                </button>
              </>
            )}

            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ring-1 ${status.cls}`}
            >
              {status.text}
            </span>
          </div>

          <p className="mt-1 font-mono text-xs text-slate-500">{apiKey.masked}</p>

          <p className="mt-1.5 text-[11px] text-slate-600">
            {apiKey.unitsToday} unit{apiKey.unitsToday === 1 ? "" : "s"} spent today
            {apiKey.lastUsedAt && <> · last used {new Date(apiKey.lastUsedAt).toLocaleString()}</>}
          </p>

          {apiKey.lastError && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-200/70">
              Google said: {apiKey.lastError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={pending || first}
            onClick={() => act(moveApiKey, { direction: "up" })}
            title="Try this key earlier"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 transition hover:border-white/25 hover:text-white disabled:opacity-25"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={pending || last}
            onClick={() => act(moveApiKey, { direction: "down" })}
            title="Try this key later"
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-slate-400 transition hover:border-white/25 hover:text-white disabled:opacity-25"
          >
            ↓
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => act(setApiKeyActive, { active: String(!apiKey.active) })}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 transition hover:border-white/25 hover:text-white disabled:opacity-40"
          >
            {apiKey.active ? "Turn off" : "Turn on"}
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => setReplacing((v) => !v)}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-400 transition hover:border-white/25 hover:text-white disabled:opacity-40"
          >
            Replace key
          </button>

          {(apiKey.exhausted || invalid) && (
            <button
              type="button"
              disabled={pending}
              onClick={() => act(clearApiKeyFlags)}
              title="Put it back in rotation without waiting for the Pacific reset"
              className="rounded-lg border border-emerald-400/25 px-2.5 py-1 text-xs text-emerald-300 transition hover:border-emerald-400/50 disabled:opacity-40"
            >
              Clear flags
            </button>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Remove "${apiKey.label}" from the pool? This cannot be undone.`)) {
                act(deleteApiKey);
              }
            }}
            className="rounded-lg border border-red-400/20 px-2.5 py-1 text-xs text-red-300/80 transition hover:border-red-400/45 hover:text-red-200 disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>

      {replacing && (
        <form
          action={(fd) => {
            run(replaceApiKey, fd);
            setNewKey("");
            setReplacing(false);
          }}
          className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4"
        >
          <input type="hidden" name="id" value={apiKey.id} />
          <input
            name="key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Paste the replacement key — AIza…"
            spellCheck={false}
            autoComplete="off"
            className="min-w-[16rem] flex-1 rounded-xl border border-white/10 bg-[#0a0e18] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || !newKey.trim()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-40"
          >
            {pending ? "Checking…" : "Verify & replace"}
          </button>
          <p className="w-full text-[11px] text-slate-600">
            Keeps the label and position. Quota and error flags are cleared, since they
            described the old key.
          </p>
        </form>
      )}

      <Notice result={result} />
    </div>
  );
}

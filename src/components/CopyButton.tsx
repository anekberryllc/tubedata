"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copy text to the clipboard.
 *
 * navigator.clipboard only exists in a secure context. This app is served over
 * plain http through Apache, which is a secure context on localhost but NOT
 * when reached by IP or hostname — so the legacy execCommand path is a real
 * fallback here, not defensive noise.
 */
async function writeClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or the document lost focus — fall through.
    }
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    // Off-screen but still focusable; position:fixed avoids scrolling the page.
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

type State = "idle" | "copied" | "failed";

/**
 * Small "Copy" affordance for a section heading. `text` is a getter so the
 * value is read at click time rather than captured on every render.
 */
export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  title,
}: {
  text: string | (() => string);
  label?: string;
  copiedLabel?: string;
  title?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Without this, the reset fires after the results are cleared on a new lookup.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const onClick = useCallback(async () => {
    const value = typeof text === "function" ? text() : text;
    if (!value) return;

    const ok = await writeClipboard(value);
    setState(ok ? "copied" : "failed");

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
  }, [text]);

  const tone =
    state === "copied"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
      : state === "failed"
        ? "border-red-400/40 bg-red-400/10 text-red-300"
        : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-sky-300";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${tone}`}
    >
      <span aria-hidden="true">{state === "copied" ? "✓" : state === "failed" ? "!" : "⧉"}</span>
      {state === "copied" ? copiedLabel : state === "failed" ? "Press Ctrl+C" : label}
    </button>
  );
}

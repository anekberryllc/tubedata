"use client";

import { UpgradeButton } from "./UpgradeButton";

export function LockedPanel({
  label,
  teaseCount,
  teaseNoun,
  children,
}: {
  label: string;
  teaseCount?: number;
  teaseNoun?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-amber-400/[0.04] to-transparent p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {label}
        </span>
        <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300 ring-1 ring-amber-400/25">
          Plus
        </span>
      </div>

      {children && (
        <div className="pointer-events-none select-none opacity-60 blur-[5px]">{children}</div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-400">
          {teaseCount && teaseCount > 0
            ? `${teaseCount} more ${teaseNoun ?? "items"} available`
            : "Available on Plus"}
        </span>
        <div className="ml-auto">
          <UpgradeButton label="Unlock" />
        </div>
      </div>
    </div>
  );
}

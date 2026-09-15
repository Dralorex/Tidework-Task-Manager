"use client";

import { useMemo, useState } from "react";

/** Collapses a long pending-invite list into a dropdown. */
export function PendingInvitesDropdown({
  invites,
}: {
  invites: { id: string; label: string; role: string; token: string }[];
}) {
  const [open, setOpen] = useState(false);
  const count = invites.length;
  const summary = useMemo(() => {
    if (count === 0) return "No pending invites";
    if (count === 1) return `1 pending invite`;
    return `${count} pending invites`;
  }, [count]);

  if (count === 0) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-[#0A3D45]/12 bg-white/70 px-2.5 py-2 text-left text-sm text-[#0A3D45]"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium">{summary}</span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open ? (
        <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-md border border-[#0A3D45]/10 bg-white/80 p-2 text-xs text-[#0A3D45]/70">
          {invites.map((inv) => (
            <li key={inv.id} className="border-b border-[#0A3D45]/8 pb-2 last:border-b-0 last:pb-0">
              <p className="font-medium text-[#0A3D45]">
                {inv.label}{" "}
                <span className="font-normal text-[#0A3D45]/55">({inv.role})</span>
              </p>
              <p className="mt-0.5 break-all text-[11px] text-[#0A3D45]/50">
                /invite/{inv.token}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

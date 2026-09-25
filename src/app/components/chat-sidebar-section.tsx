"use client";

import { useState } from "react";

/** Collapsible sidebar block for chat create flows. */
export function ChatSidebarSection({
  title,
  description,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-[#0A3D45]/10 pt-4 first:border-t-0 first:pt-0">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-semibold text-[#0A3D45]">{title}</span>
        <span className="text-[#0A3D45]/60" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="mt-3">
          {description ? (
            <p className="mb-3 text-xs text-[#0A3D45]/60">{description}</p>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

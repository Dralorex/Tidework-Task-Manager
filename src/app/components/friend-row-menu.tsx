"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removeFriendAction } from "@/app/actions/social";
import { confirmDelete } from "@/lib/confirm";

export function FriendRowMenu({
  friendshipId,
  friendLabel,
}: {
  friendshipId: string;
  friendLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function remove() {
    if (!confirmDelete(`friend ${friendLabel}`)) return;
    const fd = new FormData();
    fd.set("friendshipId", friendshipId);
    const result = await removeFriendAction(null, fd);
    setOpen(false);
    if (result?.ok) router.refresh();
    else if (result && !result.ok) alert(result.error);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Friend options"
        className="rounded-md px-2 py-1 text-[#0A3D45]/45 opacity-40 transition hover:bg-[#0A3D45]/8 hover:text-[#0A3D45] hover:opacity-100 group-hover:opacity-100"
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>
      {open ? (
        <div
          className="absolute right-0 z-30 mt-1 min-w-[10rem] rounded-lg border border-[#0A3D45]/12 bg-[#E8F7F6] py-1 shadow-md"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-[#9b2f22] hover:bg-[#E85D4C]/10"
            onClick={() => void remove()}
          >
            Remove friend
          </button>
        </div>
      ) : null}
    </div>
  );
}

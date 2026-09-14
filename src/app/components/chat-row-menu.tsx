"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteChatGroupAction,
  leaveChatAction,
} from "@/app/actions/social";

export function ChatRowMenu({
  groupId,
  isDirect,
  canDelete,
}: {
  groupId: string;
  isDirect: boolean;
  canDelete: boolean;
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

  async function run(
    action: typeof leaveChatAction,
    extra?: Record<string, string>,
  ) {
    const fd = new FormData();
    fd.set("groupId", groupId);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    }
    const result = await action(null, fd);
    setOpen(false);
    if (result?.ok) {
      router.push(isDirect ? "/app/chat?tab=dms" : "/app/chat?tab=groups");
      router.refresh();
    } else if (result && !result.ok) alert(result.error);
  }

  return (
    <div
      ref={rootRef}
      className="relative shrink-0"
      onClick={(e) => e.preventDefault()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Chat options"
        className="rounded-md px-2 py-1 text-[#0A3D45]/45 opacity-40 transition hover:bg-[#0A3D45]/8 hover:text-[#0A3D45] hover:opacity-100 group-hover:opacity-100"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
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
            className="block w-full px-3 py-2 text-left text-sm text-[#0A3D45] hover:bg-[#0A3D45]/8"
            onClick={() => void run(leaveChatAction)}
          >
            {isDirect ? "Delete chat" : "Leave group"}
          </button>
          {canDelete && !isDirect ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-[#9b2f22] hover:bg-[#E85D4C]/10"
              onClick={() => {
                if (
                  confirm(
                    "Delete this group for everyone? Messages will be removed.",
                  )
                ) {
                  void run(deleteChatGroupAction);
                }
              }}
            >
              Delete for all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteChatGroupAction,
  leaveChatAction,
} from "@/app/actions/social";
import { confirmDelete } from "@/lib/confirm";
import { MenuSurface, menuItemClass } from "@/app/components/menu-surface";

export function ChatRowMenu({
  groupId,
  isDirect,
  canDelete,
  listTab = "groups",
}: {
  groupId: string;
  isDirect: boolean;
  canDelete: boolean;
  /** Where to return after leave/delete for non-DM chats. */
  listTab?: "dms" | "groups" | "workspace-groups";
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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
      router.push(isDirect ? "/app/chat?tab=dms" : `/app/chat?tab=${listTab}`);
      router.refresh();
    } else if (result && !result.ok) alert(result.error);
  }

  return (
    <div
      className="relative shrink-0"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <MenuSurface
        open={open}
        onClose={() => setOpen(false)}
        trigger={({ ref }) => (
          <button
            ref={ref}
            type="button"
            aria-label="Chat options"
            aria-expanded={open}
            className="rounded-md px-2 py-1 text-[#0A3D45]/70 transition hover:bg-[#0A3D45]/8 hover:text-[#0A3D45]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            ···
          </button>
        )}
      >
        <button
          type="button"
          role="menuitem"
          className={menuItemClass(true)}
          onClick={() => {
            if (
              !confirmDelete(
                isDirect ? "this chat" : "your membership in this group",
              )
            ) {
              return;
            }
            void run(leaveChatAction);
          }}
        >
          {isDirect ? "Delete chat" : "Leave group"}
        </button>
        {canDelete && !isDirect ? (
          <button
            type="button"
            role="menuitem"
            className={menuItemClass(true)}
            onClick={() => {
              if (!confirmDelete("this group for everyone")) return;
              void run(deleteChatGroupAction);
            }}
          >
            Delete for all
          </button>
        ) : null}
      </MenuSurface>
    </div>
  );
}

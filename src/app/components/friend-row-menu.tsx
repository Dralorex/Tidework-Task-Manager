"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeFriendAction } from "@/app/actions/social";
import { confirmDelete } from "@/lib/confirm";
import { MenuSurface, menuItemClass } from "@/app/components/menu-surface";

export function FriendRowMenu({
  friendshipId,
  friendLabel,
}: {
  friendshipId: string;
  friendLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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
    <div className="relative shrink-0">
      <MenuSurface
        open={open}
        onClose={() => setOpen(false)}
        trigger={({ ref }) => (
          <button
            ref={ref}
            type="button"
            aria-label="Friend options"
            aria-expanded={open}
            className="rounded-md px-2 py-1 text-[#0A3D45]/70 transition hover:bg-[#0A3D45]/8 hover:text-[#0A3D45]"
            onClick={() => setOpen((v) => !v)}
          >
            ···
          </button>
        )}
      >
        <button
          type="button"
          role="menuitem"
          className={menuItemClass(true)}
          onClick={() => void remove()}
        >
          Remove friend
        </button>
      </MenuSurface>
    </div>
  );
}

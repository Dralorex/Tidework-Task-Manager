"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteFolderAction,
  renameFolderAction,
} from "@/app/actions/tasks";
import { confirmDelete } from "@/lib/confirm";
import { MenuSurface, menuItemClass } from "@/app/components/menu-surface";

export function FolderActions({
  workspaceId,
  folderId,
  folderName,
}: {
  workspaceId: string;
  folderId: string;
  folderName: string;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(folderName);
  const router = useRouter();

  useEffect(() => {
    setName(folderName);
  }, [folderName]);

  async function saveRename(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("folderId", folderId);
    fd.set("name", name.trim());
    const result = await renameFolderAction(null, fd);
    if (result?.ok) {
      setRenaming(false);
      setOpen(false);
      router.refresh();
    } else if (result && !result.ok) {
      alert(result.error);
    }
  }

  async function remove() {
    if (!confirmDelete(`folder “${folderName}” and everything inside it`)) {
      return;
    }
    const fd = new FormData();
    fd.set("workspaceId", workspaceId);
    fd.set("folderId", folderId);
    const result = await deleteFolderAction(null, fd);
    setOpen(false);
    if (result?.ok) {
      if (result.resetUrl) router.push(result.resetUrl);
      else router.refresh();
    } else if (result && !result.ok) alert(result.error);
  }

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      {renaming ? (
        <form
          onSubmit={saveRename}
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="tide-input max-w-[8rem] py-1 text-xs"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="submit"
            className="text-xs font-semibold text-[#0A3D45]"
            onClick={(e) => e.stopPropagation()}
          >
            Save
          </button>
          <button
            type="button"
            className="text-xs text-[#0A3D45]/55"
            onClick={(e) => {
              e.stopPropagation();
              setRenaming(false);
              setName(folderName);
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <MenuSurface
          open={open}
          onClose={() => setOpen(false)}
          trigger={({ ref }) => (
            <button
              ref={ref}
              type="button"
              aria-label="Folder options"
              aria-expanded={open}
              className="rounded-md px-1.5 py-0.5 text-[#0A3D45]/70 transition hover:bg-[#0A3D45]/8 hover:text-[#0A3D45]"
              onClick={(e) => {
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
            className={menuItemClass()}
            onClick={() => {
              setRenaming(true);
              setOpen(false);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className={menuItemClass(true)}
            onClick={() => void remove()}
          >
            Delete
          </button>
        </MenuSurface>
      )}
    </div>
  );
}

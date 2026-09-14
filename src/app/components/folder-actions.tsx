"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteFolderAction,
  renameFolderAction,
} from "@/app/actions/tasks";
import { confirmDelete } from "@/lib/confirm";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setName(folderName);
  }, [folderName]);

  useEffect(() => {
    if (!open && !renaming) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setRenaming(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, renaming]);

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
    <div
      ref={rootRef}
      className="relative shrink-0"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {renaming ? (
        <form onSubmit={saveRename} className="flex items-center gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="tide-input max-w-[8rem] py-1 text-xs"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <button type="submit" className="text-xs font-semibold text-[#0A3D45]">
            Save
          </button>
        </form>
      ) : (
        <>
          <button
            type="button"
            aria-label="Folder options"
            className="rounded-md px-1.5 py-0.5 text-[#0A3D45]/45 opacity-40 transition hover:bg-[#0A3D45]/8 hover:opacity-100 group-hover:opacity-100"
            onClick={() => setOpen((v) => !v)}
          >
            ···
          </button>
          {open ? (
            <div
              className="absolute right-0 z-30 mt-1 min-w-[9rem] rounded-lg border border-[#0A3D45]/12 bg-[#E8F7F6] py-1 shadow-md"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-[#0A3D45] hover:bg-[#0A3D45]/8"
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
                className="block w-full px-3 py-2 text-left text-sm text-[#9b2f22] hover:bg-[#E85D4C]/10"
                onClick={() => void remove()}
              >
                Delete
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { InlineActionForm } from "@/app/components/forms";
import { ArchiveVisibilityFields } from "@/app/components/archive-visibility-fields";
import {
  archiveFolderAction,
  unarchiveFolderAction,
} from "@/app/actions/tasks";
import {
  archiveWorkspaceAction,
  unarchiveWorkspaceAction,
} from "@/app/actions/workspaces";

export function ArchiveWorkspacePanel({
  workspaceId,
  isArchived,
  members,
}: {
  workspaceId: string;
  isArchived: boolean;
  members: { id: string; username: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (isArchived) {
    return (
      <div className="tide-panel border border-[#E85D4C]/25 bg-[#E85D4C]/8 p-4">
        <p className="text-sm font-semibold text-[#0A3D45]">
          This workspace is archived
        </p>
        <p className="mt-1 text-sm text-[#0A3D45]/70">
          History is preserved. New folders, tasks, and invites are paused until
          you restore it.
        </p>
        <InlineActionForm
          className="mt-3"
          action={unarchiveWorkspaceAction}
          submitLabel="Restore workspace"
          submitVariant="primary"
          submitClassName="min-h-11"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
        </InlineActionForm>
      </div>
    );
  }

  return (
    <div className="tide-panel p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold text-[#0A3D45]/80 underline-offset-2 hover:underline"
      >
        {open ? "Cancel archive" : "Archive workspace…"}
      </button>
      {open ? (
        <InlineActionForm
          className="mt-3 flex flex-col gap-3"
          action={archiveWorkspaceAction}
          submitLabel="Archive workspace"
          submitClassName="min-h-11 w-full"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <ArchiveVisibilityFields members={members} />
        </InlineActionForm>
      ) : (
        <p className="mt-2 text-xs text-[#0A3D45]/55">
          Soft-delete: hide from the main list without erasing tasks or history.
        </p>
      )}
    </div>
  );
}

export function ArchiveFolderControls({
  workspaceId,
  folderId,
  folderName,
  isArchived,
  members,
}: {
  workspaceId: string;
  folderId: string;
  folderName: string;
  isArchived: boolean;
  members: { id: string; username: string }[];
}) {
  const [open, setOpen] = useState(false);

  if (isArchived) {
    return (
      <div className="mt-4 rounded-xl border border-[#E85D4C]/20 bg-[#E85D4C]/8 p-3">
        <p className="text-sm text-[#0A3D45]/80">
          <span className="font-semibold">{folderName}</span> is archived. Tasks
          stay for history; new work is paused.
        </p>
        <InlineActionForm
          className="mt-2"
          action={unarchiveFolderAction}
          submitLabel="Restore folder"
          submitVariant="primary"
          submitClassName="min-h-10 text-sm"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="folderId" value={folderId} />
        </InlineActionForm>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-semibold text-[#0A3D45]/65 underline-offset-2 hover:underline"
      >
        {open ? "Cancel" : "Archive folder…"}
      </button>
      {open ? (
        <InlineActionForm
          className="mt-2 flex flex-col gap-3"
          action={archiveFolderAction}
          submitLabel="Archive folder"
          submitClassName="min-h-10 w-full text-sm"
        >
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="folderId" value={folderId} />
          <ArchiveVisibilityFields members={members} />
        </InlineActionForm>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { InlineActionForm } from "@/app/components/forms";
import {
  FriendInvitePicker,
  type InviteFriendOption,
} from "@/app/components/friend-invite-picker";
import { createGroupChatAction } from "@/app/actions/social";

type WorkspaceOption = { id: string; name: string };

/** Create a workspace group with a member picker for the selected workspace. */
export function CreateWorkspaceGroupForm({
  workspaces,
  membersByWorkspace,
}: {
  workspaces: WorkspaceOption[];
  membersByWorkspace: Record<string, InviteFriendOption[]>;
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");

  const members = useMemo(
    () => membersByWorkspace[workspaceId] ?? [],
    [membersByWorkspace, workspaceId],
  );

  if (workspaces.length === 0) return null;

  return (
    <div className="border-t border-[#0A3D45]/10 pt-5">
      <h3 className="font-semibold text-[#0A3D45]">New workspace group (Admin+)</h3>
      <p className="mt-1 text-xs text-[#0A3D45]/60">
        Pick a workspace, then choose members from that workspace.
      </p>
      <InlineActionForm
        className="mt-3 flex flex-col gap-2"
        action={createGroupChatAction}
        submitLabel="Create workspace group"
      >
        <select
          name="workspaceId"
          className="tide-input text-sm"
          required
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
        <input
          name="name"
          required
          placeholder="Group name"
          className="tide-input text-sm"
        />
        <FriendInvitePicker
          key={workspaceId}
          friends={members}
          mode="multi"
          membersName="members"
          required={false}
          searchPlaceholder="Search members"
          selectedItemNoun="member"
          emptyMessage="No other members in this workspace yet."
        />
      </InlineActionForm>
    </div>
  );
}

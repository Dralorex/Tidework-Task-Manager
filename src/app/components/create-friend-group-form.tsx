"use client";

import { InlineActionForm } from "@/app/components/forms";
import {
  FriendInvitePicker,
  type InviteFriendOption,
} from "@/app/components/friend-invite-picker";
import { createFriendGroupChatAction } from "@/app/actions/social";

/** Create a multi-friend group chat (not workspace-scoped). */
export function CreateFriendGroupForm({
  friends,
}: {
  friends: InviteFriendOption[];
}) {
  return (
    <div className="border-t border-[#0A3D45]/10 pt-5">
      <h3 className="font-semibold text-[#0A3D45]">New group</h3>
      <p className="mt-1 text-xs text-[#0A3D45]/60">
        Chat with one or more friends outside a workspace.
      </p>
      <InlineActionForm
        className="mt-3 flex flex-col gap-2"
        action={createFriendGroupChatAction}
        submitLabel="Create group"
      >
        <input
          name="name"
          required
          placeholder="Group name"
          className="tide-input text-sm"
        />
        <FriendInvitePicker
          friends={friends}
          mode="multi"
          membersName="members"
          required
          emptyMessage="Add friends first, then you can start a group."
        />
      </InlineActionForm>
    </div>
  );
}

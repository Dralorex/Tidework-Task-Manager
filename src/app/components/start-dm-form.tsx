"use client";

import { useState } from "react";
import { InlineActionForm } from "@/app/components/forms";
import { ChatSidebarSection } from "@/app/components/chat-sidebar-section";
import {
  FriendInvitePicker,
  type InviteFriendOption,
} from "@/app/components/friend-invite-picker";
import { requestWorkspaceDmAction } from "@/app/actions/social";

type WorkspaceOption = { id: string; name: string };

/** Start a DM: friend picker (hides existing DMs) or workspace username. */
export function StartDmForm({
  friends,
  friendsWithDmIds,
  workspaces,
}: {
  friends: InviteFriendOption[];
  friendsWithDmIds: string[];
  workspaces: WorkspaceOption[];
}) {
  const [scope, setScope] = useState("__friends__");
  const friendsMode = scope === "__friends__";

  return (
    <ChatSidebarSection
      title="Message someone"
      description="Pick Friends to message freely, or a workspace for members (non-friends need to accept the first message). Friends who already have a DM with you stay hidden under Friends."
    >
      <InlineActionForm
        className="flex flex-col gap-2"
        action={requestWorkspaceDmAction}
        submitLabel="Send"
      >
        <select
          name="workspaceId"
          className="tide-input text-sm"
          required
          value={scope}
          onChange={(e) => setScope(e.target.value)}
        >
          <option value="__friends__">Friends</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name}
            </option>
          ))}
        </select>
        {friendsMode ? (
          <FriendInvitePicker
            friends={friends}
            excludeIds={friendsWithDmIds}
            targetName="username"
            placeholder="Search friends"
            emptyMessage="No friends yet — add friends from the Friends tab."
          />
        ) : (
          <input
            name="username"
            required
            placeholder="Username"
            className="tide-input text-sm"
          />
        )}
        <input
          name="message"
          required
          placeholder="First message"
          className="tide-input text-sm"
        />
      </InlineActionForm>
    </ChatSidebarSection>
  );
}

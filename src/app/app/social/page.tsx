import { redirect } from "next/navigation";
import { InlineActionForm } from "@/app/components/forms";
import { FriendRowMenu } from "@/app/components/friend-row-menu";
import {
  openFriendChatAction,
  respondFriendRequestAction,
  sendFriendRequestAction,
} from "@/app/actions/social";
import { toggleFriendBirthdayVisibilityAction } from "@/app/actions/calendar";
import { getCurrentUser } from "@/lib/auth";
import { formatBirthday } from "@/lib/birthday";
import { prisma } from "@/lib/db";
import { personLabel } from "@/lib/utils";

export default async function SocialPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: user.id }, { addresseeId: user.id }],
    },
    include: { requester: true, addressee: true },
  });

  const incoming = await prisma.friendship.findMany({
    where: { addresseeId: user.id, status: "PENDING" },
    include: { requester: true },
  });

  const friends = friendships.map((f) => ({
    friendshipId: f.id,
    user: f.requesterId === user.id ? f.addressee : f.requester,
  }));
  const birthdayShares =
    friends.length > 0
      ? await prisma.birthdayShare.findMany({
          where: {
            viewerId: user.id,
            ownerId: { in: friends.map((friend) => friend.user.id) },
            status: { in: ["ACTIVE", "HIDDEN"] },
          },
          include: { owner: true },
        })
      : [];
  const birthdayByFriend = new Map(
    birthdayShares.map((share) => [share.ownerId, share]),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[#0A3D45]">
        Friends
      </h1>
      <p className="mt-2 text-[#0A3D45]/70">
        Friends can DM without sharing a workspace. Workspace-only DMs still need an
        accept on the first message.
      </p>

      <div className="tide-panel mt-8 p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
          Add a friend
        </h2>
        <InlineActionForm
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          action={sendFriendRequestAction}
          submitLabel="Send request"
        >
          <input
            name="username"
            required
            placeholder="username"
            className="tide-input"
          />
        </InlineActionForm>
      </div>

      {incoming.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
            Requests
          </h2>
          <ul className="mt-3 space-y-2">
            {incoming.map((r) => (
              <li
                key={r.id}
                className="tide-panel flex items-center justify-between gap-3 p-4"
              >
                <span>{personLabel(r.requester)}</span>
                <div className="flex gap-2">
                  <InlineActionForm
                    action={respondFriendRequestAction}
                    submitLabel="Accept"
                  >
                    <input type="hidden" name="friendshipId" value={r.id} />
                    <input type="hidden" name="accept" value="true" />
                  </InlineActionForm>
                  <InlineActionForm
                    action={respondFriendRequestAction}
                    submitLabel="Decline"
                  >
                    <input type="hidden" name="friendshipId" value={r.id} />
                    <input type="hidden" name="accept" value="false" />
                  </InlineActionForm>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#0A3D45]">
          Your circle
        </h2>
        <ul className="mt-3 space-y-2">
          {friends.length === 0 ? (
            <li className="text-[#0A3D45]/60">No friends yet.</li>
          ) : (
            friends.map(({ friendshipId, user: friend }) => {
              const birthdayShare = birthdayByFriend.get(friend.id);
              return (
                <li
                  key={friendshipId}
                  className="group tide-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0 font-medium text-[#0A3D45]">
                    {personLabel(friend)}
                    {birthdayShare?.owner.birthday ? (
                      <span className="ml-2 text-sm font-normal text-[#0A3D45]/60">
                        · {formatBirthday(birthdayShare.owner.birthday)}
                      </span>
                    ) : null}
                  </span>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {birthdayShare?.owner.birthday ? (
                      <InlineActionForm
                        action={toggleFriendBirthdayVisibilityAction}
                        submitLabel={
                          birthdayShare.status === "ACTIVE"
                            ? "Hide birthday"
                            : "Show birthday"
                        }
                      >
                        <input
                          type="hidden"
                          name="shareId"
                          value={birthdayShare.id}
                        />
                        <input
                          type="hidden"
                          name="show"
                          value={String(birthdayShare.status !== "ACTIVE")}
                        />
                      </InlineActionForm>
                    ) : null}
                    <InlineActionForm
                      action={openFriendChatAction}
                      submitLabel="Message"
                    >
                      <input type="hidden" name="friendUserId" value={friend.id} />
                    </InlineActionForm>
                    <FriendRowMenu
                      friendshipId={friendshipId}
                      friendLabel={personLabel(friend)}
                    />
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </main>
  );
}

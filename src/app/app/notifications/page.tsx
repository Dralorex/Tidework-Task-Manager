import { format } from "date-fns";
import {
  acceptInviteAction,
  declineInviteAction,
} from "@/app/actions/workspaces";
import { InlineActionForm } from "@/app/components/forms";
import { MarkNotificationsSeen } from "@/app/components/mark-notifications-seen";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type InviteMeta = {
  token?: string;
  inviteId?: string;
  workspaceId?: string;
};

function parseMeta(meta: string | null): InviteMeta {
  if (!meta) return {};
  try {
    return JSON.parse(meta) as InviteMeta;
  } catch {
    return {};
  }
}

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const hasUnread = notifications.some((n) => !n.read);

  const inviteTokens = notifications
    .filter((n) => n.type === "WORKSPACE_INVITE")
    .map((n) => parseMeta(n.meta).token)
    .filter((t): t is string => Boolean(t));

  const pendingInvites =
    inviteTokens.length > 0
      ? await prisma.invite.findMany({
          where: {
            token: { in: inviteTokens },
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          include: { workspace: true },
        })
      : [];

  const pendingByToken = new Map(pendingInvites.map((i) => [i.token, i]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <MarkNotificationsSeen hasUnread={hasUnread} />
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[#0A3D45]">
        Notifications
      </h1>
      <p className="mt-2 text-[#0A3D45]/70">
        Workspace invites and other updates. Opening this tab clears the unread
        badge.
      </p>

      <ul className="mt-8 space-y-3">
        {notifications.length === 0 ? (
          <li className="text-[#0A3D45]/60">You’re all caught up.</li>
        ) : (
          notifications.map((n) => {
            const meta = parseMeta(n.meta);
            const invite =
              n.type === "WORKSPACE_INVITE" && meta.token
                ? pendingByToken.get(meta.token)
                : undefined;

            return (
              <li key={n.id} className="tide-panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0A3D45]">{n.title}</p>
                    <p className="mt-1 text-sm text-[#0A3D45]/75">{n.body}</p>
                    <p className="mt-2 text-xs text-[#0A3D45]/50">
                      {format(n.createdAt, "MMM d · HH:mm")}
                    </p>
                  </div>

                  {invite ? (
                    <div className="flex flex-col gap-2 sm:items-end">
                      <p className="text-xs capitalize text-[#0A3D45]/60">
                        {invite.workspace.name} · {invite.role.toLowerCase()}
                      </p>
                      <div className="flex gap-2">
                        <InlineActionForm
                          action={acceptInviteAction}
                          submitLabel="Accept"
                        >
                          <input type="hidden" name="token" value={invite.token} />
                        </InlineActionForm>
                        <InlineActionForm
                          action={declineInviteAction}
                          submitLabel="Decline"
                        >
                          <input type="hidden" name="token" value={invite.token} />
                        </InlineActionForm>
                      </div>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </main>
  );
}

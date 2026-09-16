import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { FloatingChatWidget } from "@/app/components/floating-chat-widget";
import { LiveRefresh } from "@/app/components/live-refresh";
import { getAccountRosterPublic } from "@/lib/account-roster";
import { getCurrentUser } from "@/lib/auth";
import { syncBirthdayNotifications } from "@/lib/birthday";
import { syncDeadlineNotifications } from "@/lib/deadline-notifications";
import { prisma } from "@/lib/db";
import { personLabel } from "@/lib/utils";

export default async function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await Promise.all([
    syncDeadlineNotifications(user.id),
    syncBirthdayNotifications(user.id),
  ]);

  const [unreadCount, chatUnreadCount, accounts] = await Promise.all([
    prisma.notification.count({
      where: {
        userId: user.id,
        read: false,
        type: { notIn: ["CHAT_MESSAGE", "DM_REQUEST"] },
      },
    }),
    prisma.notification.count({
      where: {
        userId: user.id,
        read: false,
        type: { in: ["CHAT_MESSAGE", "DM_REQUEST"] },
      },
    }),
    getAccountRosterPublic(user.id),
  ]);

  return (
    <div className="tide-wave-bg min-h-screen">
      <LiveRefresh />
      <AppNav
        displayLabel={personLabel(user)}
        unreadCount={unreadCount}
        chatUnreadCount={chatUnreadCount}
        accounts={accounts}
      />
      {children}
      <FloatingChatWidget chatUnreadCount={chatUnreadCount} />
    </div>
  );
}

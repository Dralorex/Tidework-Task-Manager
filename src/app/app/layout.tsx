import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { LiveRefresh } from "@/app/components/live-refresh";
import { getCurrentUser } from "@/lib/auth";
import { syncDeadlineNotifications } from "@/lib/deadline-notifications";
import { prisma } from "@/lib/db";

export default async function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await syncDeadlineNotifications(user.id);

  const [unreadCount, chatUnreadCount] = await Promise.all([
    prisma.notification.count({
      where: { userId: user.id, read: false },
    }),
    prisma.notification.count({
      where: {
        userId: user.id,
        read: false,
        type: { in: ["CHAT_MESSAGE", "DM_REQUEST"] },
      },
    }),
  ]);

  return (
    <div className="tide-wave-bg min-h-screen">
      <LiveRefresh />
      <AppNav
        username={user.username}
        unreadCount={unreadCount}
        chatUnreadCount={chatUnreadCount}
      />
      {children}
    </div>
  );
}

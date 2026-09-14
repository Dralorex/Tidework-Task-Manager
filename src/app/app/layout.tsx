import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { getCurrentUser } from "@/lib/auth";
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

  await syncDeadlineNotifications(user.id);

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });

  return (
    <div className="tide-wave-bg min-h-screen">
      <AppNav displayLabel={personLabel(user)} unreadCount={unreadCount} />
      {children}
    </div>
  );
}

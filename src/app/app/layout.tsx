import { redirect } from "next/navigation";
import { AppNav } from "@/app/components/app-nav";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AppSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const unreadCount = await prisma.notification.count({
    where: {
      userId: user.id,
      read: false,
      type: { notIn: ["CHAT_MESSAGE"] },
    },
  });

  return (
    <div className="tide-wave-bg min-h-screen">
      <AppNav username={user.username} unreadCount={unreadCount} />
      {children}
    </div>
  );
}

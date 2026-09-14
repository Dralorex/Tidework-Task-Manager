"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";

export function AppNav({
  username,
  unreadCount = 0,
  chatUnreadCount = 0,
}: {
  username: string;
  unreadCount?: number;
  chatUnreadCount?: number;
}) {
  const pathname = usePathname();

  const active =
    pathname.startsWith("/app/notifications")
      ? "notifications"
      : pathname.startsWith("/app/calendar")
        ? "calendar"
        : pathname.startsWith("/app/chat")
          ? "chat"
          : pathname.startsWith("/app/social")
            ? "social"
            : "home";

  const link = (href: string, key: typeof active, label: string, badge?: number) => (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
        active === key
          ? "bg-[#0A3D45] text-[#E8F7F6]"
          : "text-[#0A3D45]/80 hover:bg-[#0A3D45]/8"
      }`}
    >
      {label}
      {badge && badge > 0 ? (
        <span
          className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 ${
            active === key
              ? "bg-[#E8F7F6] text-[#0A3D45]"
              : "bg-[#E85D4C] text-white"
          }`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-[#0A3D45]/10 bg-[#E8F7F6]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/app" className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
          Tidework
        </Link>
        <nav className="flex flex-wrap items-center gap-1">
          {link("/app", "home", "Workspaces")}
          {link("/app/calendar", "calendar", "Calendar")}
          {link("/app/chat", "chat", "Chat", chatUnreadCount)}
          {link("/app/social", "social", "Friends")}
          {link("/app/notifications", "notifications", "Notifications", unreadCount)}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[#0A3D45]/70 sm:inline">@{username}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-[#0A3D45]/70 underline-offset-2 hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";

type NavKey = "home" | "calendar" | "chat" | "social" | "notifications";

const TABS: {
  href: string;
  key: NavKey;
  label: string;
  shortLabel: string;
  match: (path: string) => boolean;
}[] = [
  {
    href: "/app",
    key: "home",
    label: "Workspaces",
    shortLabel: "Spaces",
    match: (path) => path === "/app" || path.startsWith("/app/w/"),
  },
  {
    href: "/app/calendar",
    key: "calendar",
    label: "Calendar",
    shortLabel: "Cal",
    match: (path) => path.startsWith("/app/calendar"),
  },
  {
    href: "/app/chat",
    key: "chat",
    label: "Chat",
    shortLabel: "Chat",
    match: (path) => path.startsWith("/app/chat"),
  },
  {
    href: "/app/social",
    key: "social",
    label: "Friends",
    shortLabel: "Friends",
    match: (path) => path.startsWith("/app/social"),
  },
  {
    href: "/app/notifications",
    key: "notifications",
    label: "Notifications",
    shortLabel: "Alerts",
    match: (path) => path.startsWith("/app/notifications"),
  },
];

export function AppNav({
  username,
  unreadCount = 0,
}: {
  username: string;
  /** @deprecated active is derived from the path */
  active?: NavKey;
  unreadCount?: number;
}) {
  const pathname = usePathname() ?? "/app";

  return (
    <header className="sticky top-0 z-20 border-b border-[#0A3D45]/10 bg-[#E8F7F6]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4">
        <Link
          href="/app"
          className="shrink-0 font-[family-name:var(--font-display)] text-xl text-[#0A3D45]"
        >
          Tidework
        </Link>
        <nav className="flex max-w-[70%] flex-wrap items-center justify-end gap-0.5 sm:max-w-none sm:gap-1">
          {TABS.map((tab) => {
            const isActive = tab.match(pathname);
            const badge =
              tab.key === "notifications" && unreadCount > 0 ? unreadCount : 0;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm transition sm:px-3 ${
                  isActive
                    ? "bg-[#0A3D45] text-[#E8F7F6]"
                    : "text-[#0A3D45]/80 hover:bg-[#0A3D45]/8"
                }`}
              >
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {badge > 0 ? (
                  <span
                    className={`min-w-[1.15rem] rounded-full px-1 text-center text-[10px] font-semibold leading-4 sm:min-w-[1.25rem] sm:text-[11px] sm:leading-5 ${
                      isActive
                        ? "bg-[#E8F7F6] text-[#0A3D45]"
                        : "bg-[#E85D4C] text-white"
                    }`}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-sm text-[#0A3D45]/70 sm:inline">
            @{username}
          </span>
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

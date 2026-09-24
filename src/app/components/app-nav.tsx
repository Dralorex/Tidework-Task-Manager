import Link from "next/link";
import { signOutAction } from "@/app/actions/auth";

export function AppNav({
  username,
  active,
}: {
  username: string;
  active?: "home" | "calendar" | "chat" | "social";
}) {
  const link = (href: string, key: typeof active, label: string) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-sm transition ${
        active === key
          ? "bg-[#0A3D45] text-[#E8F7F6]"
          : "text-[#0A3D45]/80 hover:bg-[#0A3D45]/8"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-[#0A3D45]/10 bg-[#E8F7F6]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/app" className="font-[family-name:var(--font-display)] text-xl text-[#0A3D45]">
          Tidework
        </Link>
        <nav className="flex max-w-[55%] flex-wrap items-center justify-end gap-1 sm:max-w-none">
          {link("/app", "home", "Workspaces")}
          {link("/app/calendar", "calendar", "Calendar")}
          {link("/app/chat", "chat", "Chat")}
          {link("/app/social", "social", "Friends")}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[#0A3D45]/70 sm:inline">@{username}</span>
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-[#0A3D45]/70 underline-offset-2 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

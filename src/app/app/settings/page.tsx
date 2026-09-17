import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DisplayThemeSettings } from "@/app/components/display-theme-settings";
import { getCurrentUser } from "@/lib/auth";
import { THEME_COOKIE, LEGACY_THEME_COOKIE, parseDisplayTheme } from "@/lib/theme";
import Link from "next/link";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const cookieStore = await cookies();
  const theme = parseDisplayTheme(
    cookieStore.get(THEME_COOKIE)?.value ??
      cookieStore.get(LEGACY_THEME_COOKIE)?.value,
  );

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[color:var(--tide-deep)]">
        Settings
      </h1>
      <p className="mt-2 text-sm text-[color:var(--tide-deep)]/65">
        App preferences for this device. Profile details stay under{" "}
        <Link href="/app/profile" className="font-semibold underline-offset-2 hover:underline">
          Profile
        </Link>
        .
      </p>

      <div className="tide-panel mt-8 p-5">
        <DisplayThemeSettings currentTheme={theme} />
      </div>
    </main>
  );
}

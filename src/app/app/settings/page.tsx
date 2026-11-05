import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DisplayThemeSettings } from "@/app/components/display-theme-settings";
import { InterfaceSettings } from "@/app/components/interface-settings";
import { WebPushSettings } from "@/app/components/web-push-settings";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePersonalInterfacePrefs } from "@/lib/interface-prefs";
import { getWebPushVapidStatus } from "@/lib/web-push-server";
import { THEME_COOKIE, LEGACY_THEME_COOKIE, THEME_MIGRATION_COOKIE, parseDisplayTheme } from "@/lib/theme";
import { AppLink } from "@/app/components/app-link";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const cookieStore = await cookies();
  const theme = parseDisplayTheme(
    cookieStore.get(THEME_COOKIE)?.value ??
      cookieStore.get(LEGACY_THEME_COOKIE)?.value,
    { migratedV2: cookieStore.get(THEME_MIGRATION_COOKIE)?.value === "1" },
  );

  const [prefsRow, pushSubCount, vapid] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        interfacePrefsJson: true,
        showInterfaceTogglesInWorkspace: true,
      },
    }),
    prisma.webPushSubscription.count({ where: { userId: user.id } }),
    getWebPushVapidStatus(),
  ]);

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[color:var(--tide-deep)]">
        Settings
      </h1>
      <p className="mt-2 text-sm text-[color:var(--tide-deep)]/65">
        App preferences for this device and account. Profile details stay under{" "}
        <AppLink
          href="/app/profile"
          className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
          compactPending
        >
          Profile
        </AppLink>
        .
      </p>

      <div className="mt-8 space-y-4">
        <WebPushSettings
          initialServerSubscriptionCount={pushSubCount}
          initialConfigured={vapid.configured}
          initialPairValid={vapid.pairValid}
          initialPublicKey={vapid.publicKey ?? ""}
          initialSource={vapid.source}
        />

        <InterfaceSettings
          prefs={parsePersonalInterfacePrefs(prefsRow.interfacePrefsJson)}
          showTogglesInWorkspace={prefsRow.showInterfaceTogglesInWorkspace}
        />

        <details className="tide-panel p-5">
          <summary className="cursor-pointer font-semibold text-[color:var(--tide-deep)]">
            Display
          </summary>
          <div className="mt-4">
            <DisplayThemeSettings currentTheme={theme} />
          </div>
        </details>
      </div>
    </main>
  );
}

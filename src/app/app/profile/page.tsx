import Link from "next/link";
import { redirect } from "next/navigation";
import { BirthdaySettingsForm } from "@/app/components/birthday-settings-form";
import { DeleteAccountPanel } from "@/app/components/delete-account-panel";
import { ProfileAvatarPanel } from "@/app/components/profile-avatar-panel";
import { ProfileSettingsForm } from "@/app/components/profile-settings-form";
import { getCurrentUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { personLabel } from "@/lib/utils";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[#0A3D45]">
        Profile
      </h1>
      <p className="mt-2 text-sm text-[#0A3D45]/70">
        Shown as {personLabel(user)} across Rowgon. Nickname is preferred once
        set.
      </p>

      <div className="tide-panel mt-8 space-y-8 p-5">
        <ProfileAvatarPanel
          userId={user.id}
          label={personLabel(user)}
          shape={user.avatarShape}
          status={user.avatarStatus}
        />

        <div className="border-t border-[#0A3D45]/10 pt-6">
          <ProfileSettingsForm
            username={user.username}
            nickname={user.nickname ?? ""}
            email={user.email}
          />
        </div>

        <div className="border-t border-[#0A3D45]/10 pt-6">
          <BirthdaySettingsForm
            birthday={user.birthday}
            shareBirthdayFriends={user.shareBirthdayFriends}
            shareBirthdayWorkspaces={user.shareBirthdayWorkspaces}
            askBeforeShareBirthday={user.askBeforeShareBirthday}
          />
        </div>
      </div>

      {isPlatformAdmin(user) ? (
        <p className="mt-4 text-sm text-[#0A3D45]/70">
          <Link
            href="/app/moderation/avatars"
            className="underline underline-offset-2"
          >
            Review pending avatars
          </Link>
        </p>
      ) : null}

      <div className="mt-8">
        <DeleteAccountPanel />
      </div>
    </main>
  );
}

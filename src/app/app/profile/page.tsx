import { redirect } from "next/navigation";
import { ProfileSettingsForm } from "@/app/components/profile-settings-form";
import { getCurrentUser } from "@/lib/auth";
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
        Shown as {personLabel(user)} across Tidework. Nickname is preferred once
        set.
      </p>

      <div className="tide-panel mt-8 p-5">
        <ProfileSettingsForm
          username={user.username}
          nickname={user.nickname ?? ""}
          email={user.email}
        />
      </div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { InlineActionForm } from "@/app/components/forms";
import { updateProfileAction } from "@/app/actions/profile";
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
        <InlineActionForm
          className="flex flex-col gap-4"
          action={updateProfileAction}
          submitLabel="Save profile"
        >
          <label className="block text-sm text-[#0A3D45]">
            <span className="mb-1 block font-medium">Username</span>
            <input
              name="username"
              required
              defaultValue={user.username}
              autoComplete="username"
              className="tide-input w-full"
            />
            <span className="mt-1 block text-xs text-[#0A3D45]/55">
              Login handle · letters, numbers, underscores
            </span>
          </label>

          <label className="block text-sm text-[#0A3D45]">
            <span className="mb-1 block font-medium">Nickname</span>
            <input
              name="nickname"
              defaultValue={user.nickname ?? ""}
              placeholder="e.g. Alex River"
              className="tide-input w-full"
            />
            <span className="mt-1 block text-xs text-[#0A3D45]/55">
              Capitals and spaces allowed. Leave blank to show @username.
            </span>
          </label>

          <label className="block text-sm text-[#0A3D45]">
            <span className="mb-1 block font-medium">Email</span>
            {user.email ? (
              <>
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  className="tide-input w-full opacity-80"
                />
                <span className="mt-1 block text-xs text-[#0A3D45]/55">
                  Email is set and can’t be changed here.
                </span>
              </>
            ) : (
              <>
                <input
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  className="tide-input w-full"
                />
                <span className="mt-1 block text-xs text-[#0A3D45]/55">
                  Optional · used for password resets
                </span>
              </>
            )}
          </label>
        </InlineActionForm>
      </div>
    </main>
  );
}

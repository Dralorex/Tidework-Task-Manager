import { redirect } from "next/navigation";
import { AvatarReviewControls } from "@/app/components/avatar-review-controls";
import { UserAvatar } from "@/app/components/user-avatar";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { personLabel } from "@/lib/utils";

export default async function AvatarModerationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isPlatformAdmin(user)) redirect("/app/profile");

  const pending = await prisma.user.findMany({
    where: {
      avatarStatus: "pending",
      deletedAt: null,
      avatarKey: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      username: true,
      nickname: true,
      avatarShape: true,
      avatarStatus: true,
      updatedAt: true,
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[#0A3D45]">
        Avatar review
      </h1>
      <p className="mt-2 text-sm text-[#0A3D45]/70">
        Approve or reject profile pictures flagged for human review.
      </p>

      {pending.length === 0 ? (
        <p className="tide-panel mt-8 p-5 text-sm text-[#0A3D45]/70">
          No avatars waiting.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {pending.map((row) => (
            <li
              key={row.id}
              className="tide-panel flex flex-wrap items-center gap-4 p-4"
            >
              <UserAvatar
                userId={row.id}
                label={personLabel(row)}
                shape={row.avatarShape}
                status={row.avatarStatus}
                size={64}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#0A3D45]">
                  {personLabel(row)}
                </p>
                <p className="text-xs text-[#0A3D45]/55">@{row.username}</p>
              </div>
              <AvatarReviewControls userId={row.id} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

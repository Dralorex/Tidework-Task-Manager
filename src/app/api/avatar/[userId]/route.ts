import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { isR2Configured, presignDownload } from "@/lib/r2";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  if (!isR2Configured()) {
    return NextResponse.json({ error: "Storage unavailable." }, { status: 503 });
  }

  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ error: "Missing user." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      avatarKey: true,
      avatarStatus: true,
      deletedAt: true,
    },
  });

  if (!target || target.deletedAt || !target.avatarKey) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const viewer = await getCurrentUser();
  const canSeePending =
    viewer &&
    (viewer.id === target.id || isPlatformAdmin(viewer));

  if (target.avatarStatus !== "approved" && !canSeePending) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const { url } = await presignDownload(target.avatarKey);
    return NextResponse.redirect(url, { status: 302 });
  } catch {
    return NextResponse.json({ error: "Unavailable." }, { status: 502 });
  }
}

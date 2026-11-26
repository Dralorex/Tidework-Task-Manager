"use server";

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { scanAvatarImage } from "@/lib/avatar-moderation";
import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";
import {
  AVATAR_MAX_BYTES,
  buildAvatarKey,
  deleteObject,
  isR2Configured,
  putObjectBytes,
} from "@/lib/r2";

export type AvatarActionResult =
  | { ok: true; status: string; message: string }
  | { ok: false; error: string };

const SHAPES = new Set(["circle", "rounded"]);

function revalidateAvatarPaths() {
  revalidatePath("/app", "layout");
  revalidatePath("/app/profile");
  revalidatePath("/app/moderation/avatars");
}

export async function uploadAvatarAction(
  _prev: AvatarActionResult | null,
  formData: FormData,
): Promise<AvatarActionResult> {
  if (!isR2Configured()) {
    return {
      ok: false,
      error: "File storage (R2) is not configured yet.",
    };
  }

  try {
    const user = await requireUser();
    const shapeRaw = String(formData.get("shape") ?? "circle").trim();
    const shape = SHAPES.has(shapeRaw) ? shapeRaw : "circle";
    const file = formData.get("avatar");
    if (!(file instanceof File)) {
      return { ok: false, error: "Choose a PNG image first." };
    }
    if (file.type && file.type !== "image/png") {
      return { ok: false, error: "Profile pictures must be PNG files." };
    }
    if (file.size <= 0 || file.size > AVATAR_MAX_BYTES) {
      return {
        ok: false,
        error: "Cropped image must be under 2 MB.",
      };
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const scan = await scanAvatarImage(bytes);
    if (scan.verdict === "blocked") {
      await prisma.avatarModerationEvent.create({
        data: {
          userId: user.id,
          verdict: "blocked",
          source: "auto",
          detail: scan.detail,
        },
      });
      return {
        ok: false,
        error: "That image couldn’t be used. Try a different photo.",
      };
    }

    const objectId = nanoid(16);
    const key = buildAvatarKey(user.id, objectId);
    await putObjectBytes({
      key,
      contentType: "image/png",
      body: bytes,
    });

    const previousKey = user.avatarKey;
    const status = scan.verdict === "approved" ? "approved" : "pending";

    await prisma.user.update({
      where: { id: user.id },
      data: {
        avatarKey: key,
        avatarShape: shape,
        avatarStatus: status,
        avatarReviewedAt: scan.verdict === "approved" ? new Date() : null,
        avatarReviewNote:
          scan.verdict === "approved" ? scan.detail : null,
      },
    });

    await prisma.avatarModerationEvent.create({
      data: {
        userId: user.id,
        verdict: status === "approved" ? "approved" : "pending",
        source: "auto",
        detail: scan.detail,
      },
    });

    if (previousKey && previousKey !== key) {
      await deleteObject(previousKey).catch(() => null);
    }

    revalidateAvatarPaths();
    return {
      ok: true,
      status,
      message:
        status === "approved"
          ? "Profile picture saved."
          : "Uploaded — waiting for a quick safety review before it shows publicly.",
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Couldn’t upload that picture.";
    if (message === "UNAUTHORIZED") {
      return { ok: false, error: "Sign in to update your profile picture." };
    }
    return { ok: false, error: message };
  }
}

export async function removeAvatarAction(): Promise<AvatarActionResult> {
  try {
    const user = await requireUser();
    const previousKey = user.avatarKey;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        avatarKey: null,
        avatarStatus: "none",
        avatarReviewedAt: null,
        avatarReviewNote: null,
      },
    });
    if (previousKey) {
      await deleteObject(previousKey).catch(() => null);
    }
    revalidateAvatarPaths();
    return { ok: true, status: "none", message: "Profile picture removed." };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Couldn’t remove that picture.";
    if (message === "UNAUTHORIZED") {
      return { ok: false, error: "Sign in first." };
    }
    return { ok: false, error: message };
  }
}

export async function reviewAvatarAction(
  userId: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<AvatarActionResult> {
  try {
    const actor = await requireUser();
    if (!isPlatformAdmin(actor)) {
      return { ok: false, error: "Only site admins can review avatars." };
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || !target.avatarKey) {
      return { ok: false, error: "No avatar pending for that user." };
    }

    if (decision === "rejected") {
      const key = target.avatarKey;
      await prisma.user.update({
        where: { id: target.id },
        data: {
          avatarKey: null,
          avatarStatus: "rejected",
          avatarReviewedAt: new Date(),
          avatarReviewNote: note?.trim() || "Rejected by moderator.",
        },
      });
      await deleteObject(key).catch(() => null);
    } else {
      await prisma.user.update({
        where: { id: target.id },
        data: {
          avatarStatus: "approved",
          avatarReviewedAt: new Date(),
          avatarReviewNote: note?.trim() || "Approved by moderator.",
        },
      });
    }

    await prisma.avatarModerationEvent.create({
      data: {
        userId: target.id,
        actorId: actor.id,
        verdict: decision,
        source: "human",
        detail: note?.trim() || null,
      },
    });

    revalidateAvatarPaths();
    return {
      ok: true,
      status: decision,
      message: decision === "approved" ? "Avatar approved." : "Avatar rejected.",
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Review failed.";
    if (message === "UNAUTHORIZED") {
      return { ok: false, error: "Sign in first." };
    }
    return { ok: false, error: message };
  }
}

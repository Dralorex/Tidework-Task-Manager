"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { pushAlertInboxForUsers } from "@/lib/ably-server";
import { prisma } from "@/lib/db";
import {
  isWebPushConfigured,
  sendWebPushToUsers,
} from "@/lib/web-push-server";
import type { ActionResult } from "@/app/actions/auth";

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      read: false,
      type: { notIn: ["CHAT_MESSAGE", "DM_REQUEST"] },
    },
    data: { read: true },
  });
  await pushAlertInboxForUsers([user.id]);
  revalidatePath("/app", "layout");
  revalidatePath("/app/notifications");
}

export async function markNotificationReadAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const id = String(formData.get("notificationId") ?? "");
  if (!id) return { ok: false, error: "Missing notification." };

  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { read: true },
  });

  await pushAlertInboxForUsers([user.id]);
  revalidatePath("/app", "layout");
  revalidatePath("/app/notifications");
  return { ok: true };
}

/** Send one lock-screen push to the current user’s saved subscriptions. */
export async function sendTestWebPushAction(): Promise<ActionResult> {
  const user = await requireUser();
  if (!isWebPushConfigured()) {
    return {
      ok: false,
      error: "Web push isn’t configured on the server (missing VAPID keys).",
    };
  }

  const count = await prisma.webPushSubscription.count({
    where: { userId: user.id },
  });
  if (count === 0) {
    return {
      ok: false,
      error:
        "No push subscription saved for your account yet. Tap Enable notifications again on this device.",
    };
  }

  const result = await sendWebPushToUsers([user.id], {
    title: "Rowgon test",
    body: "Push is working on this device.",
    url: "/app/settings",
    tag: "rowgon-test",
  });

  if (result.sent === 0) {
    return {
      ok: false,
      error:
        result.failed > 0
          ? `Push provider rejected the send${result.lastError ? ` (${result.lastError})` : ""}. Confirm WEB_PUSH_VAPID_PUBLIC_KEY and PRIVATE_KEY are a matching pair on Vercel, then redeploy and tap Enable again.`
          : "No active subscriptions to send to. Tap Enable notifications again.",
    };
  }

  return { ok: true };
}

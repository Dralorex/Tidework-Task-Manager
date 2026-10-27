"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { pushAlertInboxForUsers } from "@/lib/ably-server";
import { prisma } from "@/lib/db";
import {
  getWebPushVapidStatus,
  isWebPushConfigured,
  saveWebPushVapidConfig,
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

export type TestWebPushResult =
  | { ok: true; sent: number; attempted: number; subscriptionCount: number }
  | { ok: false; error: string; subscriptionCount?: number };

/** Send one lock-screen push to the current user’s saved subscriptions. */
export async function sendTestWebPushAction(): Promise<TestWebPushResult> {
  const user = await requireUser();
  const vapid = await getWebPushVapidStatus();
  if (!vapid.configured) {
    return {
      ok: false,
      error: "Web push isn’t configured on the server (missing VAPID keys).",
      subscriptionCount: 0,
    };
  }
  if (!vapid.pairValid) {
    return {
      ok: false,
      error:
        "VAPID public and private keys don’t match on the server. Every push is rejected (usually HTTP 403). Paste a matching pair under “Repair push keys” below, or fix WEB_PUSH_VAPID_* on Vercel.",
      subscriptionCount: 0,
    };
  }
  if (!(await isWebPushConfigured())) {
    return {
      ok: false,
      error: "Web push isn’t configured on the server (missing VAPID keys).",
      subscriptionCount: 0,
    };
  }

  const count = await prisma.webPushSubscription.count({
    where: { userId: user.id },
  });
  if (count === 0) {
    return {
      ok: false,
      error:
        "No push subscription saved on the server for your account. Tap Enable / Re-save on this device, then try again.",
      subscriptionCount: 0,
    };
  }

  const result = await sendWebPushToUsers([user.id], {
    title: "Rowgon test",
    body: "Push is working on this device.",
    url: "/app/settings",
    tag: "rowgon-test",
    urgency: "high",
  });

  if (result.sent === 0) {
    return {
      ok: false,
      subscriptionCount: count,
      error:
        result.failed > 0
          ? `Push provider rejected the send (${result.attempted} device(s)${result.lastError ? `: ${result.lastError}` : ""}). If you see 403, the VAPID keys don’t match — use Repair push keys below.`
          : result.stale > 0
            ? "Saved subscriptions were stale and removed. Tap Re-save on this device, then Send test again."
            : "No active subscriptions to send to. Tap Enable notifications again.",
    };
  }

  return {
    ok: true,
    sent: result.sent,
    attempted: result.attempted,
    subscriptionCount: count,
  };
}

/** Save a matching VAPID pair to the DB (overrides broken Vercel env). */
export async function saveWebPushVapidAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const publicKey = String(formData.get("publicKey") ?? "");
  const privateKey = String(formData.get("privateKey") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();

  const result = await saveWebPushVapidConfig({
    publicKey,
    privateKey,
    subject: subject || undefined,
    updatedById: user.id,
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/app/settings");
  return { ok: true };
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  findRosterAccount,
  getAccountRosterPublic,
  removeRosterAccount,
} from "@/lib/account-roster";
import {
  destroySession,
  getCurrentUser,
  requireUser,
  setSessionCookieFromToken,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/app/actions/auth";

export async function switchAccountAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { ok: false, error: "Missing account." };

  const entry = await findRosterAccount(userId);
  if (!entry) {
    return { ok: false, error: "That account isn’t saved on this device." };
  }

  const session = await prisma.session.findUnique({
    where: { token: entry.token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.deletedAt) {
    await removeRosterAccount(userId);
    return { ok: false, error: "That account session expired. Sign in again." };
  }

  // Keep other device accounts; only move the active cookie.
  await setSessionCookieFromToken(session.token, session.expiresAt);
  redirect("/app");
}

export async function signOutCurrentAction() {
  await destroySession({ removeFromRoster: true });
  const remaining = await getAccountRosterPublic();
  if (remaining.length > 0) {
    const next = remaining[0];
    const entry = await findRosterAccount(next.userId);
    if (entry) {
      const session = await prisma.session.findUnique({
        where: { token: entry.token },
      });
      if (session && session.expiresAt >= new Date()) {
        await setSessionCookieFromToken(session.token, session.expiresAt);
        redirect("/app");
      }
    }
  }
  redirect("/login");
}

export async function removeDeviceAccountAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { ok: false, error: "Missing account." };

  if (userId === user.id) {
    await signOutCurrentAction();
  }

  await removeRosterAccount(userId);
  revalidatePath("/app/accounts");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function listDeviceAccountsAction() {
  const user = await getCurrentUser();
  return getAccountRosterPublic(user?.id);
}

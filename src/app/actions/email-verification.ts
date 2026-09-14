"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { welcomeAccountEmail } from "@/lib/email-templates";
import { issueEmailVerification } from "@/lib/email-verification";
import { sendEmail } from "@/lib/mail";
import { isValidEmail } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/auth";

export async function requestEmailChangeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const emailRaw = String(formData.get("email") ?? "").trim();
  if (!emailRaw || !isValidEmail(emailRaw)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const email = emailRaw.toLowerCase();

  if (user.email && user.email.toLowerCase() === email) {
    return { ok: false, error: "That’s already your verified email." };
  }

  const taken = await prisma.user.findFirst({
    where: { email, NOT: { id: user.id } },
  });
  if (taken) return { ok: false, error: "That email is already in use." };

  const issued = await issueEmailVerification({
    userId: user.id,
    email,
    username: user.username,
  });
  if (!issued.ok) {
    return {
      ok: false,
      error: issued.error,
      retryAfterSec: issued.retryAfterSec,
    };
  }

  return {
    ok: true,
    needsEmailVerification: true,
    email: issued.email,
    emailed: !issued.mocked,
  };
}

export async function verifyEmailCodeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "").trim();
  const nextRaw = String(formData.get("next") ?? "").trim();
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/app";

  if (!/^\d{4}$/.test(code)) {
    return { ok: false, error: "Enter the 4-digit code from your email." };
  }

  const pending = await prisma.emailVerification.findUnique({
    where: { userId: user.id },
  });
  if (!pending) {
    return { ok: false, error: "No verification is pending. Request a new code." };
  }
  if (pending.expiresAt < new Date()) {
    return { ok: false, error: "That code expired. Resend a new one." };
  }
  if (pending.code !== code) {
    return { ok: false, error: "That code doesn’t match. Try again." };
  }

  const taken = await prisma.user.findFirst({
    where: { email: pending.email, NOT: { id: user.id } },
  });
  if (taken) {
    return { ok: false, error: "That email was just claimed by another account." };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { email: pending.email },
  });
  await prisma.emailVerification.delete({ where: { id: pending.id } });

  const content = welcomeAccountEmail({
    username: updated.username,
    nickname: updated.nickname,
  });
  await sendEmail({
    to: pending.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  revalidatePath("/app", "layout");
  revalidatePath("/app/profile");

  const redirectAfter = String(formData.get("redirectAfter") ?? "") === "true";
  if (redirectAfter) {
    redirect(next);
  }

  return { ok: true, emailVerified: true };
}

export async function resendEmailCodeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const pending = await prisma.emailVerification.findUnique({
    where: { userId: user.id },
  });
  if (!pending) {
    return { ok: false, error: "No verification is pending." };
  }

  const issued = await issueEmailVerification({
    userId: user.id,
    email: pending.email,
    username: user.username,
    forceResend: true,
  });
  if (!issued.ok) {
    return {
      ok: false,
      error: issued.error,
      retryAfterSec: issued.retryAfterSec,
    };
  }

  return {
    ok: true,
    needsEmailVerification: true,
    email: issued.email,
    emailed: !issued.mocked,
    resent: true,
  };
}

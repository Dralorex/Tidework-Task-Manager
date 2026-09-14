"use server";

import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  passwordResetEmail,
  welcomeAccountEmail,
} from "@/lib/email-templates";
import { sendEmail } from "@/lib/mail";
import { isValidEmail, isValidUsername, normalizeUsername } from "@/lib/utils";

export type ActionResult =
  | { ok: true; resetUrl?: string; emailed?: boolean }
  | { ok: false; error: string };

function safeNextPath(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function signUpAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const usernameRaw = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const emailRaw = String(formData.get("email") ?? "").trim();
  const noEmailAck = String(formData.get("noEmailAck") ?? "") === "true";
  const next = safeNextPath(formData.get("next"));
  const username = normalizeUsername(usernameRaw);

  if (!isValidUsername(usernameRaw.trim())) {
    return {
      ok: false,
      error: "Username must be 3–30 characters: letters, numbers, underscores.",
    };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (emailRaw && !isValidEmail(emailRaw)) {
    return { ok: false, error: "That email doesn’t look valid." };
  }
  if (!emailRaw && !noEmailAck) {
    return {
      ok: false,
      error:
        "Add an email, or confirm you understand the risks of skipping one.",
    };
  }

  if (await prisma.user.findUnique({ where: { username } })) {
    return { ok: false, error: "That username is already taken." };
  }
  if (emailRaw) {
    if (await prisma.user.findUnique({ where: { email: emailRaw.toLowerCase() } })) {
      return { ok: false, error: "That email is already in use." };
    }
  }

  const email = emailRaw ? emailRaw.toLowerCase() : null;
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      email,
    },
  });

  if (email) {
    const content = welcomeAccountEmail({ username: user.username });
    await sendEmail({
      to: email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  }

  await createSession(user.id);
  redirect(next ?? "/app");
}

export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Incorrect username or password." };
  }
  await createSession(user.id);
  redirect(next ?? "/app");
}

export async function signOutAction() {
  await destroySession();
  redirect("/");
}

export async function requestPasswordResetAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { ok: false, error: "Enter your username or email." };

  const user = identifier.includes("@")
    ? await prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
    : await prisma.user.findUnique({
        where: { username: normalizeUsername(identifier) },
      });

  // Always look successful for unknown users (no account enumeration).
  if (!user) return { ok: true, emailed: true };

  if (!user.email) {
    return {
      ok: false,
      error:
        "No email on this account — add one in settings, or ask a workspace admin for help.",
    };
  }

  const token = nanoid(48);
  await prisma.passwordResetToken.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  const content = passwordResetEmail({ username: user.username, token });
  const sent = await sendEmail({
    to: user.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!sent.ok) {
    return {
      ok: false,
      error: "Couldn’t send the reset email. Try again in a moment.",
    };
  }

  // In local/dev without RESEND_API_KEY, surface the link so resets still work.
  if (sent.mocked) {
    return { ok: true, emailed: false, resetUrl: content.resetUrl };
  }

  return { ok: true, emailed: true };
}

export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const record = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) {
    return { ok: false, error: "This reset link is invalid or expired." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  await createSession(record.userId);
  redirect("/app");
}

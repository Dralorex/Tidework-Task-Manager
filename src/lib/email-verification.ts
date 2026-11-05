import { prisma } from "@/lib/db";
import {
  emailCodeLockAlertEmail,
  emailVerificationCodeEmail,
} from "@/lib/email-templates";
import { sendEmail } from "@/lib/mail";
import { randomInt } from "crypto";

export const EMAIL_CODE_TTL_MS = 1000 * 60 * 15;
export const EMAIL_RESEND_COOLDOWN_MS = 1000 * 30;
/** Hard ceiling — record is cleared after this many wrong guesses. */
export const EMAIL_CODE_MAX_ATTEMPTS = 5;
/** Soft lock one before max (4 of 5). */
export const EMAIL_CODE_SOFT_LOCK_ATTEMPTS = EMAIL_CODE_MAX_ATTEMPTS - 1;
/** Lock after this many successful resends (not counting the first issue). */
export const EMAIL_CODE_RESEND_LOCK_COUNT = 3;
export const EMAIL_CODE_LOCK_MS = 1000 * 60 * 10;
export const EMAIL_CODE_LOCK_MINUTES = 10;

export function generateEmailCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export type CodeLockBlock = {
  ok: false;
  error: string;
  retryAfterSec: number;
};

export function activeLockRetryAfterSec(
  lockedUntil: Date | null | undefined,
): number | null {
  if (!lockedUntil) return null;
  const waitMs = lockedUntil.getTime() - Date.now();
  if (waitMs <= 0) return null;
  return Math.max(1, Math.ceil(waitMs / 1000));
}

export function codeLockBlock(lockedUntil: Date): CodeLockBlock {
  const retryAfterSec =
    activeLockRetryAfterSec(lockedUntil) ?? EMAIL_CODE_LOCK_MINUTES * 60;
  return {
    ok: false,
    error: `Verification is locked. Try again in ${Math.ceil(retryAfterSec / 60)} min.`,
    retryAfterSec,
  };
}

async function notifyCodeLock(opts: {
  email: string;
  username: string;
  reason: "attempts" | "resends";
}) {
  const content = emailCodeLockAlertEmail({
    username: opts.username,
    reason: opts.reason,
    lockMinutes: EMAIL_CODE_LOCK_MINUTES,
  });
  try {
    await sendEmail({
      to: opts.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  } catch (err) {
    console.error("[rowgon:email-code-lock]", err);
  }
}

/** Apply a 10-minute lock (idempotent while already locked) and alert the email. */
export async function lockPendingSignup(opts: {
  id: string;
  email: string;
  username: string;
  reason: "attempts" | "resends";
  currentLockedUntil?: Date | null;
}): Promise<Date> {
  const existingRetry = activeLockRetryAfterSec(opts.currentLockedUntil);
  if (existingRetry && opts.currentLockedUntil) {
    return opts.currentLockedUntil;
  }
  const lockedUntil = new Date(Date.now() + EMAIL_CODE_LOCK_MS);
  await prisma.pendingSignup.update({
    where: { id: opts.id },
    data: { lockedUntil },
  });
  await notifyCodeLock({
    email: opts.email,
    username: opts.username,
    reason: opts.reason,
  });
  return lockedUntil;
}

export async function lockEmailVerification(opts: {
  id: string;
  userId: string;
  email: string;
  username: string;
  reason: "attempts" | "resends";
  currentLockedUntil?: Date | null;
}): Promise<Date> {
  const existingRetry = activeLockRetryAfterSec(opts.currentLockedUntil);
  if (existingRetry && opts.currentLockedUntil) {
    return opts.currentLockedUntil;
  }
  const lockedUntil = new Date(Date.now() + EMAIL_CODE_LOCK_MS);
  await prisma.emailVerification.update({
    where: { id: opts.id },
    data: { lockedUntil },
  });
  await notifyCodeLock({
    email: opts.email,
    username: opts.username,
    reason: opts.reason,
  });
  return lockedUntil;
}

/**
 * Record a wrong guess. Soft-locks at 4 attempts (1 before max) and emails
 * the connected address. Returns the updated attempt count + optional lock.
 */
export async function registerPendingSignupFailedAttempt(opts: {
  id: string;
  email: string;
  username: string;
  lockedUntil?: Date | null;
}): Promise<{ attempts: number; lockedUntil: Date | null; lockBlock?: CodeLockBlock }> {
  const updated = await prisma.pendingSignup.update({
    where: { id: opts.id },
    data: { attempts: { increment: 1 } },
  });
  if (updated.attempts >= EMAIL_CODE_SOFT_LOCK_ATTEMPTS) {
    const lockedUntil = await lockPendingSignup({
      id: opts.id,
      email: opts.email,
      username: opts.username,
      reason: "attempts",
      currentLockedUntil: opts.lockedUntil ?? updated.lockedUntil,
    });
    return {
      attempts: updated.attempts,
      lockedUntil,
      lockBlock: codeLockBlock(lockedUntil),
    };
  }
  return { attempts: updated.attempts, lockedUntil: updated.lockedUntil };
}

export async function registerEmailVerificationFailedAttempt(opts: {
  id: string;
  userId: string;
  email: string;
  username: string;
  lockedUntil?: Date | null;
}): Promise<{ attempts: number; lockedUntil: Date | null; lockBlock?: CodeLockBlock }> {
  const updated = await prisma.emailVerification.update({
    where: { id: opts.id },
    data: { attempts: { increment: 1 } },
  });
  if (updated.attempts >= EMAIL_CODE_SOFT_LOCK_ATTEMPTS) {
    const lockedUntil = await lockEmailVerification({
      id: opts.id,
      userId: opts.userId,
      email: opts.email,
      username: opts.username,
      reason: "attempts",
      currentLockedUntil: opts.lockedUntil ?? updated.lockedUntil,
    });
    return {
      attempts: updated.attempts,
      lockedUntil,
      lockBlock: codeLockBlock(lockedUntil),
    };
  }
  return { attempts: updated.attempts, lockedUntil: updated.lockedUntil };
}

export async function issueEmailVerification(opts: {
  userId: string;
  email: string;
  username: string;
  forceResend?: boolean;
}): Promise<
  | { ok: true; email: string; mocked: boolean; retryAfterSec?: number }
  | { ok: false; error: string; retryAfterSec?: number }
> {
  const email = opts.email.toLowerCase();
  const existing = await prisma.emailVerification.findUnique({
    where: { userId: opts.userId },
  });

  const lockRetry = activeLockRetryAfterSec(existing?.lockedUntil);
  if (lockRetry && existing?.lockedUntil) {
    return codeLockBlock(existing.lockedUntil);
  }

  if (existing && opts.forceResend) {
    const waitMs =
      EMAIL_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime());
    if (waitMs > 0) {
      return {
        ok: false,
        error: `Wait ${Math.ceil(waitMs / 1000)}s before resending.`,
        retryAfterSec: Math.ceil(waitMs / 1000),
      };
    }
  }

  const code = generateEmailCode();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  const now = new Date();
  const nextResendCount =
    existing && opts.forceResend ? existing.resendCount + 1 : 0;

  // Persist the pending code first; only bump lastSentAt after a successful send
  // so a Resend failure doesn’t start the 30s cooldown.
  // New codes always reset the guess counter so resend recovers from near-lockout.
  await prisma.emailVerification.upsert({
    where: { userId: opts.userId },
    create: {
      userId: opts.userId,
      email,
      code,
      expiresAt,
      attempts: 0,
      resendCount: 0,
      lockedUntil: null,
      lastSentAt: existing?.lastSentAt ?? new Date(0),
    },
    update: {
      email,
      code,
      expiresAt,
      attempts: 0,
      resendCount: nextResendCount,
      // Clear an expired lock when issuing a fresh code after the window.
      lockedUntil: null,
    },
  });

  const content = emailVerificationCodeEmail({
    username: opts.username,
    code,
    email,
  });
  const sent = await sendEmail({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  const row = await prisma.emailVerification.update({
    where: { userId: opts.userId },
    data: { lastSentAt: now },
  });

  if (nextResendCount >= EMAIL_CODE_RESEND_LOCK_COUNT) {
    await lockEmailVerification({
      id: row.id,
      userId: opts.userId,
      email,
      username: opts.username,
      reason: "resends",
      currentLockedUntil: null,
    });
  }

  return { ok: true, email, mocked: sent.mocked };
}

/** Hold signup details until the email code is confirmed — no User row yet. */
export async function issuePendingSignup(opts: {
  username: string;
  passwordHash: string;
  email: string;
  nickname?: string | null;
  signInDuration?: string;
  forceResend?: boolean;
  pendingId?: string;
}): Promise<
  | { ok: true; email: string; pendingId: string; mocked: boolean; retryAfterSec?: number }
  | { ok: false; error: string; retryAfterSec?: number }
> {
  const email = opts.email.toLowerCase();
  const existing = opts.pendingId
    ? await prisma.pendingSignup.findUnique({ where: { id: opts.pendingId } })
    : await prisma.pendingSignup.findUnique({ where: { username: opts.username } });

  const lockRetry = activeLockRetryAfterSec(existing?.lockedUntil);
  if (lockRetry && existing?.lockedUntil) {
    return codeLockBlock(existing.lockedUntil);
  }

  if (existing && opts.forceResend) {
    const waitMs =
      EMAIL_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt.getTime());
    if (waitMs > 0) {
      return {
        ok: false,
        error: `Wait ${Math.ceil(waitMs / 1000)}s before resending.`,
        retryAfterSec: Math.ceil(waitMs / 1000),
      };
    }
  }

  const code = generateEmailCode();
  const expiresAt = new Date(Date.now() + EMAIL_CODE_TTL_MS);
  const now = new Date();
  const signInDuration =
    opts.signInDuration?.trim() || existing?.signInDuration || "session";
  const nickname =
    opts.nickname !== undefined ? opts.nickname : existing?.nickname ?? null;
  const nextResendCount =
    existing && opts.forceResend ? existing.resendCount + 1 : 0;

  // Issuing a new code (including resend) resets the guess counter.
  const pending = existing
    ? await prisma.pendingSignup.update({
        where: { id: existing.id },
        data: {
          passwordHash: opts.passwordHash || existing.passwordHash,
          email,
          nickname,
          code,
          expiresAt,
          attempts: 0,
          resendCount: nextResendCount,
          lockedUntil: null,
          ...(opts.signInDuration?.trim()
            ? { signInDuration: opts.signInDuration.trim() }
            : {}),
        },
      })
    : await prisma.pendingSignup.create({
        data: {
          username: opts.username,
          passwordHash: opts.passwordHash,
          email,
          nickname,
          code,
          expiresAt,
          attempts: 0,
          resendCount: 0,
          lockedUntil: null,
          signInDuration,
          lastSentAt: new Date(0),
        },
      });

  const content = emailVerificationCodeEmail({
    username: opts.username,
    code,
    email,
  });
  const sent = await sendEmail({
    to: email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  await prisma.pendingSignup.update({
    where: { id: pending.id },
    data: { lastSentAt: now },
  });

  if (nextResendCount >= EMAIL_CODE_RESEND_LOCK_COUNT) {
    await lockPendingSignup({
      id: pending.id,
      email,
      username: opts.username,
      reason: "resends",
      currentLockedUntil: null,
    });
  }

  return { ok: true, email, pendingId: pending.id, mocked: sent.mocked };
}

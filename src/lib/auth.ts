import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";

const SESSION_COOKIE = "tidework_session";
/** Persistent “remember me” login length. */
const REMEMBER_DAYS = 30;
/**
 * Server-side ceiling for browser-session logins (cookie itself is cleared
 * when the browser closes). Keeps abandoned DB rows from lasting forever.
 */
const QUICK_SESSION_DAYS = 1;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(
  userId: string,
  opts: { remember?: boolean } = {},
) {
  const remember = opts.remember ?? true;
  const token = nanoid(48);
  const expiresAt = new Date();
  expiresAt.setDate(
    expiresAt.getDate() + (remember ? REMEMBER_DAYS : QUICK_SESSION_DAYS),
  );

  await prisma.session.create({
    data: { token, userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Remember me → persistent cookie. Otherwise a session cookie that
    // disappears when the browser is closed.
    ...(remember ? { expires: expiresAt } : {}),
  });

  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  if (session.user.deletedAt) {
    await prisma.session.deleteMany({ where: { userId: session.user.id } });
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

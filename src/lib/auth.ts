import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { upsertRosterAccount, removeRosterAccount } from "@/lib/account-roster";
import { prisma } from "@/lib/db";
import { personLabel } from "@/lib/utils";

const SESSION_COOKIE = "tidework_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = nanoid(48);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  await prisma.session.create({
    data: { token, userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  await upsertRosterAccount({
    userId: user.id,
    username: user.username,
    label: personLabel(user),
    token,
    expiresAt,
  });

  return token;
}

export async function setSessionCookieFromToken(
  token: string,
  expiresAt: Date,
) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(opts: { removeFromRoster?: boolean } = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await prisma.session.findUnique({ where: { token } });
    await prisma.session.deleteMany({ where: { token } });
    cookieStore.delete(SESSION_COOKIE);
    if (opts.removeFromRoster !== false && session) {
      await removeRosterAccount(session.userId);
    }
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
    await removeRosterAccount(session.user.id);
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

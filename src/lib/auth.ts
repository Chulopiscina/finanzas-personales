import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Role, type User } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ACCESS_COOKIE, SESSION_COOKIE, signAccessToken } from "@/lib/jwt";

export type SessionUser = Pick<User, "id" | "name" | "email" | "role" | "lastLoginAt">;

export class UnauthorizedError extends Error {
  status = 401;
}

export class ForbiddenError extends Error {
  status = 403;
}

const SESSION_DAYS = 7;

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function assertPasswordStrength(password: string) {
  if (password.length < 8) {
    throw new Error("La contraseña debe tener al menos 8 caracteres.");
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("La contraseña debe combinar mayúsculas, minúsculas y números.");
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  };
}

function publicUser(user: User): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    lastLoginAt: user.lastLoginAt
  };
}

export async function createSession(user: User, requestHeaders?: Headers) {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const currentHeaders = requestHeaders ?? (await headers());
  const userAgent = currentHeaders.get("user-agent");
  const ipAddress =
    currentHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    currentHeaders.get("x-real-ip") ??
    null;

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: tokenHash(rawToken),
      userAgent,
      ipAddress,
      expiresAt
    }
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const accessToken = await signAccessToken(
    {
      sub: user.id,
      sid: session.id,
      role: user.role,
      email: user.email,
      name: user.name
    },
    expiresAt
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, sessionCookieOptions(expiresAt));
  cookieStore.set(ACCESS_COOKIE, accessToken, sessionCookieOptions(expiresAt));

  return session;
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    await prisma.session.deleteMany({
      where: { tokenHash: tokenHash(rawToken) }
    });
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ACCESS_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!rawToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(rawToken) },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return {
    sessionId: session.id,
    user: publicUser(session.user)
  };
}

export async function requireUser() {
  const session = await getSessionUser();
  if (!session) {
    throw new UnauthorizedError("Sesión no válida.");
  }

  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.user.role !== Role.ADMIN) {
    throw new ForbiddenError("Permiso de administrador requerido.");
  }

  return session;
}

export function canAccessUser(currentUser: SessionUser, targetUserId?: string | null) {
  if (!targetUserId || targetUserId === currentUser.id) {
    return true;
  }

  return currentUser.role === Role.ADMIN;
}

export function getAuthorizedUserId(currentUser: SessionUser, requestedUserId?: string | null) {
  if (!requestedUserId || requestedUserId === currentUser.id) {
    return currentUser.id;
  }

  if (currentUser.role !== Role.ADMIN) {
    throw new ForbiddenError("No puedes acceder a datos de otro usuario.");
  }

  return requestedUserId;
}

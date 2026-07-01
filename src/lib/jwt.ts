import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "pf_session";
export const ACCESS_COOKIE = "pf_access";

export type AccessTokenPayload = {
  sub: string;
  sid: string;
  role: Role;
  email: string;
  name: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET debe tener al menos 32 caracteres.");
  }

  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: AccessTokenPayload, expiresAt: Date) {
  return new SignJWT({
    sid: payload.sid,
    role: payload.role,
    email: payload.email,
    name: payload.name
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer("finanzas-personales")
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecret());
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: "finanzas-personales"
  });

  if (!payload.sub || !payload.sid || !payload.role || !payload.email || !payload.name) {
    throw new Error("Token incompleto.");
  }

  return {
    sub: payload.sub,
    sid: String(payload.sid),
    role: payload.role as Role,
    email: String(payload.email),
    name: String(payload.name)
  };
}

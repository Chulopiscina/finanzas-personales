import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { InputError } from "@/lib/input-error";
import { requireShortcuts, shortcutTokenHash } from "@/lib/shortcuts";
import { shortcutInstallConfig, shortcutSetupLink } from "@/lib/shortcut-install";

export async function startShortcutPairing(userId: string, accountId: string, origin: string, sessionId?: string) {
  requireShortcuts();
  if (!shortcutInstallConfig().installUrl) throw new InputError("El atajo BBVA todavía no está publicado y verificado. No se ha iniciado la conexión.", 503);
  const code = "pair_" + randomBytes(32).toString("base64url");
  let setupUrl: string;
  try { setupUrl = shortcutSetupLink(origin, code); }
  catch { throw new InputError("Abre la conexión desde el dominio HTTPS de la aplicación."); }
  const pairing = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${"pairing:" + userId}))`;
    if (sessionId && !await tx.session.findFirst({ where: { id: sessionId, userId, expiresAt: { gt: new Date() } }, select: { id: true } })) throw new InputError("Tu sesión ha caducado. Vuelve a iniciar sesión.", 401);
    const account = await tx.account.findFirst({ where: { id: accountId, userId, isArchived: false, currency: "EUR" } });
    if (!account) throw new InputError("Selecciona una cuenta propia activa en EUR.");
    const now = new Date();
    if (await tx.shortcutPairing.count({ where: { userId, createdAt: { gt: new Date(now.getTime() - 3_600_000) } } }) >= 10) throw new InputError("Demasiados intentos de conexión. Inténtalo dentro de una hora.", 429);
    await tx.shortcutPairing.updateMany({ where: { userId, accountId, consumedAt: null, canceledAt: null }, data: { canceledAt: now } });
    return tx.shortcutPairing.create({ data: { userId, accountId, codeHash: shortcutTokenHash(code), expiresAt: new Date(now.getTime() + 5 * 60_000) }, select: { id: true, expiresAt: true } });
  });
  return { id: pairing.id, expiresAt: pairing.expiresAt.toISOString(), setupUrl };
}

export async function exchangeShortcutPairing(value: unknown) {
  requireShortcuts();
  if (typeof value !== "string" || !/^pair_[A-Za-z0-9_-]{43}$/.test(value)) throw new InputError("Enlace de vinculación inválido.", 401);
  const codeHash = shortcutTokenHash(value);
  const token = "fp_" + randomBytes(32).toString("base64url");
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${codeHash}))`;
    const pairing = await tx.shortcutPairing.findUnique({ where: { codeHash } });
    if (!pairing || pairing.consumedAt || pairing.canceledAt || pairing.expiresAt <= new Date()) throw new InputError("El enlace ha caducado o ya se utilizó. Vuelve a Conectar BBVA.", 410);
    // Serialize with password/role revocations and with concurrent setup cancellations.
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${"pairing:" + pairing.userId}))`;
    const fresh = await tx.shortcutPairing.findUniqueOrThrow({ where: { id: pairing.id } });
    if (fresh.consumedAt || fresh.canceledAt || fresh.expiresAt <= new Date()) throw new InputError("El enlace ha caducado o ya se utilizó.", 410);
    const account = await tx.account.findFirst({ where: { id: pairing.accountId, userId: pairing.userId, isArchived: false, currency: "EUR" } });
    if (!account) throw new InputError("La cuenta ya no está disponible.", 410);
    const device = await tx.shortcutDevice.create({ data: { userId: pairing.userId, accountId: pairing.accountId, name: "BBVA en iPhone", tokenHash: shortcutTokenHash(token), expiresAt: new Date(Date.now() + 90 * 86_400_000) }, select: { id: true, expiresAt: true } });
    await tx.shortcutPairing.update({ where: { id: pairing.id }, data: { consumedAt: new Date(), deviceId: device.id } });
    return { pairingId: pairing.id, deviceId: device.id, expiresAt: device.expiresAt.toISOString() };
  });
  // Credential returned exactly once to the shortcut, never to the browser/status endpoint.
  return { ...result, token };
}

export async function shortcutPairingStatus(userId: string, id: string) {
  requireShortcuts();
  const pairing = await prisma.shortcutPairing.findFirst({ where: { id, userId }, include: { account: { select: { isArchived: true, currency: true, userId: true } }, device: { select: { id: true, revokedAt: true, expiresAt: true, lastVerifiedAt: true, lastUsedAt: true } } } });
  if (!pairing) throw new InputError("Conexión no encontrada.", 404);
  const device = pairing.device;
  const unavailable = pairing.account.isArchived || pairing.account.currency !== "EUR" || pairing.account.userId !== userId;
  const status = unavailable ? "unavailable" : pairing.canceledAt ? "canceled" : device ? device.revokedAt ? "disconnected" : device.expiresAt <= new Date() ? "expired" : device.lastVerifiedAt ? "verified" : "paired" : pairing.expiresAt <= new Date() || pairing.consumedAt ? "expired" : "waiting";
  return { id: pairing.id, status, expiresAt: pairing.expiresAt.toISOString(), lastNotificationAt: device?.lastUsedAt?.toISOString() ?? null };
}

export async function verifyShortcutConnection(authorization: string | null) {
  requireShortcuts();
  const token = authorization?.match(/^Bearer (fp_[A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) throw new InputError("Credencial inválida.", 401);
  const tokenHash = shortcutTokenHash(token);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${tokenHash}))`;
    const device = await tx.shortcutDevice.findUnique({ where: { tokenHash }, include: { account: true } });
    const now = new Date();
    if (!device || device.revokedAt || device.expiresAt <= now || device.account.isArchived || device.account.currency !== "EUR" || device.account.userId !== device.userId) throw new InputError("Conexión caducada, desconectada o cuenta no disponible.", 401);
    const reset = now.getTime() - device.windowStart.getTime() >= 3_600_000;
    if (!reset && device.windowCount >= 120) throw new InputError("Demasiadas comprobaciones. Reintenta más tarde.", 429);
    await tx.shortcutDevice.update({ where: { id: device.id }, data: { lastVerifiedAt: now, windowStart: reset ? now : device.windowStart, windowCount: reset ? 1 : { increment: 1 } } });
    // Stable text marker for Shortcuts: boolean-to-text is localized by iOS.
    return { ok: true, connection: "verified", checkedAt: now.toISOString() };
  });
}
